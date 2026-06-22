import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessDemand } from '@/lib/permissions'

type Params = { params: { id: string; updateId: string } }

// POST /api/demands/[id]/updates/[updateId]/replies  body: { content }
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!demand) return apiError('Demanda não encontrada', 404)
  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)
  if (!canAccessDemand(session, { ...demand, collaboratorUserIds })) return apiError('Sem permissão', 403)

  const update = await prisma.demandUpdate.findFirst({ where: { id: params.updateId, demandId: params.id }, select: { id: true } })
  if (!update) return apiError('Evolução não encontrada', 404)

  const body = await req.json()
  const content = String(body.content ?? '').trim()
  if (!content) return apiError('Mensagem vazia', 400)
  if (content.length > 1000) return apiError('Mensagem muito longa', 400)

  const reply = await prisma.demandUpdateReply.create({
    data: { updateId: params.updateId, authorId: session.user.id, content },
    include: { author: { select: { id: true, name: true } } },
  })

  // Conta como atividade na demanda (sinaliza novidade no Kanban/listas)
  prisma.demand.update({ where: { id: params.id }, data: { updatedAt: new Date() } }).catch(() => {})

  return apiSuccess(reply, 201)
}

// DELETE /api/demands/[id]/updates/[updateId]/replies  body: { replyId } — autor remove a própria
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const body = await req.json().catch(() => ({}))
  const replyId = String(body.replyId ?? '')
  if (!replyId) return apiError('replyId obrigatório', 400)

  const reply = await prisma.demandUpdateReply.findFirst({
    where: { id: replyId, updateId: params.updateId },
    select: { id: true, authorId: true },
  })
  if (!reply) return apiError('Resposta não encontrada', 404)

  const isAdmin = ['master', 'admin', 'director'].includes(session.user.role)
  if (reply.authorId !== session.user.id && !isAdmin) return apiError('Sem permissão', 403)

  await prisma.demandUpdateReply.delete({ where: { id: replyId } })
  return apiSuccess({ ok: true })
}
