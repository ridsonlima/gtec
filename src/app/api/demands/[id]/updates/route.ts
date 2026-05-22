import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canUpdateDemand, canContributeToDemand } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!demand) return apiError('Demanda nao encontrada', 404)

  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)

  if (!canContributeToDemand(session, { ...demand, collaboratorUserIds })) {
    return apiError('Sem permissao', 403)
  }

  const body = await req.json()

  // Somente quem tem canUpdateDemand pode alterar status
  if (body.statusAfter && !canUpdateDemand(session, { ...demand, collaboratorUserIds })) {
    return apiError('Sem permissao para alterar status', 403)
  }

  const update = await prisma.$transaction(async (tx) => {
    const created = await tx.demandUpdate.create({
      data: {
        demandId: demand.id,
        authorId: session.user.id,
        content: body.content || '',
        statusBefore: demand.status,
        statusAfter: body.statusAfter || null,
      },
      include: { author: { select: { id: true, name: true } } },
    })

    if (body.statusAfter && body.statusAfter !== demand.status) {
      await tx.demand.update({
        where: { id: demand.id },
        data: {
          status: body.statusAfter,
          completedAt: body.statusAfter === 'completed' ? new Date() : null,
          isOverdue: body.statusAfter === 'completed' || body.statusAfter === 'cancelled' ? false : demand.isOverdue,
        },
      })
    }

    return created
  })

  return apiSuccess(update, 201)
}
