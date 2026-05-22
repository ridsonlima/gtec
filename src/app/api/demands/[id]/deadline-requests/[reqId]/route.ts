import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canUpdateDemand } from '@/lib/permissions'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; reqId: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!demand) return apiError('Demanda não encontrada', 404)

  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)
  if (!canUpdateDemand(session, { ...demand, collaboratorUserIds })) {
    return apiError('Apenas coordenadores podem revisar solicitações de prazo', 403)
  }

  const extensionReq = await prisma.deadlineExtensionRequest.findUnique({
    where: { id: params.reqId },
  })
  if (!extensionReq || extensionReq.demandId !== params.id) {
    return apiError('Solicitação não encontrada', 404)
  }
  if (extensionReq.status !== 'pending') {
    return apiError('Solicitação já foi revisada', 409)
  }

  const { action, reviewNote } = await req.json()
  if (action !== 'approve' && action !== 'reject') {
    return apiError('Ação inválida', 400)
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.deadlineExtensionRequest.update({
      where: { id: params.reqId },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    })

    if (action === 'approve') {
      await tx.demand.update({
        where: { id: params.id },
        data: { dueDate: extensionReq.proposedDate, isOverdue: false },
      })
    }

    return updated
  })

  return apiSuccess(result)
}
