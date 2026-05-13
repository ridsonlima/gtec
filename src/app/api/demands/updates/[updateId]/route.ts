import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

function canChange(sessionUserId: string, role: string, authorId: string, demandStatus: string) {
  const privileged = ['master', 'admin', 'director'].includes(role)
  const stillOpen = !['completed', 'cancelled'].includes(demandStatus)
  return privileged || (sessionUserId === authorId && stillOpen)
}

export async function PATCH(req: NextRequest, { params }: { params: { updateId: string } }) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)

  const existing = await prisma.demandUpdate.findUnique({
    where: { id: params.updateId },
    include: { demand: { select: { status: true } } },
  })
  if (!existing) return apiError('Atualizacao nao encontrada', 404)
  if (!canChange(session.user.id, session.user.role, existing.authorId, existing.demand.status)) return apiError('Sem permissao', 403)

  const body = await req.json()
  const updated = await prisma.demandUpdate.update({
    where: { id: params.updateId },
    data: { content: body.content ?? existing.content },
  })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { updateId: string } }) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)

  const existing = await prisma.demandUpdate.findUnique({
    where: { id: params.updateId },
    include: { demand: { select: { status: true } } },
  })
  if (!existing) return apiError('Atualizacao nao encontrada', 404)
  if (!canChange(session.user.id, session.user.role, existing.authorId, existing.demand.status)) return apiError('Sem permissao', 403)

  await prisma.demandUpdate.delete({ where: { id: params.updateId } })
  return apiSuccess({ ok: true })
}
