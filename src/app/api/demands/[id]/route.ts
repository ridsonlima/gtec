import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessDemand, canUpdateDemand } from '@/lib/permissions'
import { audit } from '@/lib/audit'

const VALID_STATUSES = ['pending', 'in_progress', 'blocked', 'completed', 'cancelled']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: {
      area:        { select: { name: true } },
      responsible: { select: { name: true } },
    },
  })
  if (!demand) return apiError('Demanda não encontrada', 404)
  if (!canAccessDemand(session, demand)) return apiError('Sem acesso', 403)

  return apiSuccess(demand)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({ where: { id: params.id } })
  if (!demand) return apiError('Demanda não encontrada', 404)
  if (!canUpdateDemand(session, demand)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { status } = body

  if (!status || !VALID_STATUSES.includes(status)) {
    return apiError('Status inválido', 400)
  }

  const updated = await prisma.demand.update({
    where: { id: params.id },
    data: {
      status,
      isOverdue: ['completed', 'cancelled'].includes(status) ? false : demand.isOverdue,
    },
  })

  await audit({ userId: session.user.id, action: 'demand.update', objectType: 'demand', objectId: params.id })
  return apiSuccess(updated)
}
