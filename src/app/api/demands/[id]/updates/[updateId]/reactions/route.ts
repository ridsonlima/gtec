import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessDemand } from '@/lib/permissions'

const EMOJIS_PERMITIDOS = ['👍', '❤️', '✅', '🎉', '👀', '❓', '🔥', '👎']

type Params = { params: { id: string; updateId: string } }

// POST /api/demands/[id]/updates/[updateId]/reactions  body: { emoji }
// Alterna (toggle) a reação do usuário àquele emoji.
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

  const body = await req.json()
  const emoji = String(body.emoji ?? '')
  if (!EMOJIS_PERMITIDOS.includes(emoji)) return apiError('Emoji inválido', 400)

  const update = await prisma.demandUpdate.findFirst({ where: { id: params.updateId, demandId: params.id }, select: { id: true } })
  if (!update) return apiError('Evolução não encontrada', 404)

  const existente = await prisma.demandUpdateReaction.findUnique({
    where: { updateId_userId_emoji: { updateId: params.updateId, userId: session.user.id, emoji } },
  })

  let reacted: boolean
  if (existente) {
    await prisma.demandUpdateReaction.delete({ where: { id: existente.id } })
    reacted = false
  } else {
    await prisma.demandUpdateReaction.create({
      data: { updateId: params.updateId, userId: session.user.id, emoji },
    })
    reacted = true
  }

  return apiSuccess({ emoji, reacted })
}
