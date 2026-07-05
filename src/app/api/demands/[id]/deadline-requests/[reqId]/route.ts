import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canApproveDeadline } from '@/lib/permissions'

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
  if (!canApproveDeadline(session, { ...demand, collaboratorUserIds })) {
    return apiError('Apenas o coordenador da área pode aprovar prorrogações de prazo', 403)
  }

  const extensionReq = await prisma.deadlineExtensionRequest.findUnique({
    where: { id: params.reqId },
  })
  if (!extensionReq || extensionReq.demandId !== params.id) {
    return apiError('Solicitação não encontrada', 404)
  }
  const { action, reviewNote } = await req.json()
  if (action !== 'approve' && action !== 'reject') {
    return apiError('Ação inválida', 400)
  }
  // Aprovar só vale para pendente; rejeitar vale para pendente (recusa) OU aprovada (reverter).
  if (action === 'approve' && extensionReq.status !== 'pending') {
    return apiError('Solicitação já foi revisada', 409)
  }
  if (action === 'reject' && extensionReq.status === 'rejected') {
    return apiError('Solicitação já foi rejeitada', 409)
  }

  const eraAprovada = extensionReq.status === 'approved'

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.deadlineExtensionRequest.update({
      where: { id: params.reqId },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
        // Ao aprovar, guarda o prazo anterior para permitir reverter depois.
        ...(action === 'approve' ? { previousDueDate: demand.dueDate } : {}),
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
    } else if (eraAprovada && extensionReq.previousDueDate) {
      // Reverter uma prorrogação já aprovada: restaura o prazo anterior (se ainda em vigor).
      const emVigor = demand.dueDate.getTime() === extensionReq.proposedDate.getTime()
      if (emVigor) {
        const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
        await tx.demand.update({
          where: { id: params.id },
          data: {
            dueDate: extensionReq.previousDueDate,
            isOverdue: new Date(extensionReq.previousDueDate) < inicioHoje,
          },
        })
      }
    }

    return updated
  })

  return apiSuccess(result)
}
