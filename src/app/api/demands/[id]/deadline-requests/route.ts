import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canContributeToDemand } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!demand) return apiError('Demanda não encontrada', 404)

  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)
  if (!canContributeToDemand(session, { ...demand, collaboratorUserIds })) {
    return apiError('Sem permissão', 403)
  }

  // Só permite uma solicitação pendente por vez
  const pending = await prisma.deadlineExtensionRequest.findFirst({
    where: { demandId: params.id, status: 'pending' },
  })
  if (pending) return apiError('Já existe uma solicitação de prorrogação em aberto', 409)

  const { proposedDate, justification } = await req.json()
  if (!proposedDate || !justification?.trim()) {
    return apiError('Nova data e justificativa são obrigatórias', 400)
  }

  const proposed = new Date(proposedDate)
  if (isNaN(proposed.getTime()) || proposed <= demand.dueDate) {
    return apiError('A nova data deve ser posterior ao prazo atual', 400)
  }

  const request = await prisma.deadlineExtensionRequest.create({
    data: {
      demandId: params.id,
      requestedById: session.user.id,
      proposedDate: proposed,
      justification: justification.trim(),
    },
    include: {
      requestedBy: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(request, 201)
}
