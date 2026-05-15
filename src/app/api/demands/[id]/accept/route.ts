import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { notifyDemandAccepted } from '@/lib/notifications'
import { audit, ACTIONS } from '@/lib/audit'

// POST /api/demands/[id]/accept
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, areaId: true, requestingAreaId: true,
      acceptanceStatus: true, requestingArea: { select: { name: true } },
    },
  })

  if (!demand) return apiError('Demanda não encontrada', 404)
  if (!demand.requestingAreaId) return apiError('Demanda não é interárea', 400)
  if (demand.acceptanceStatus !== 'pending_acceptance') return apiError('Demanda não está aguardando aceite', 400)

  // Apenas gestores (canWrite) da área executora podem aceitar
  if (!canAccessArea(session, demand.areaId, true)) {
    return apiError('Apenas gestores da área executora podem aceitar esta demanda', 403)
  }

  const updated = await prisma.demand.update({
    where: { id: params.id },
    data: {
      acceptanceStatus: 'accepted',
      slaStatus: 'ok',
      acceptedAt: new Date(),
      acceptedById: session.user.id,
    },
  })

  Promise.all([
    notifyDemandAccepted(demand.id, demand.title, demand.requestingAreaId, session.user.name),
    audit({
      userId: session.user.id,
      action: ACTIONS.DEMAND_UPDATED,
      objectType: 'demand',
      objectId: demand.id,
      metadata: { action: 'accepted' },
    }),
  ]).catch(console.error)

  return apiSuccess(updated)
}
