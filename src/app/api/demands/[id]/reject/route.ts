import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { notifyDemandRejected } from '@/lib/notifications'
import { audit, ACTIONS } from '@/lib/audit'

// POST /api/demands/[id]/reject
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, areaId: true, requestingAreaId: true,
      acceptanceStatus: true,
    },
  })

  if (!demand) return apiError('Demanda não encontrada', 404)
  if (!demand.requestingAreaId) return apiError('Demanda não é interárea', 400)
  if (demand.acceptanceStatus !== 'pending_acceptance') return apiError('Demanda não está aguardando aceite', 400)

  if (!canAccessArea(session, demand.areaId, true)) {
    return apiError('Apenas gestores da área executora podem rejeitar esta demanda', 403)
  }

  const body = await req.json()
  const reason = (body.reason ?? '').trim()
  if (!reason) return apiError('Informe o motivo da rejeição', 400)

  const updated = await prisma.demand.update({
    where: { id: params.id },
    data: {
      acceptanceStatus: 'rejected',
      slaStatus: 'ok',
      rejectedAt: new Date(),
      rejectedById: session.user.id,
      rejectionReason: reason,
    },
  })

  Promise.all([
    notifyDemandRejected(demand.id, demand.title, demand.requestingAreaId, session.user.name, reason),
    audit({
      userId: session.user.id,
      action: ACTIONS.DEMAND_UPDATED,
      objectType: 'demand',
      objectId: demand.id,
      metadata: { action: 'rejected', reason },
    }),
  ]).catch(console.error)

  return apiSuccess(updated)
}
