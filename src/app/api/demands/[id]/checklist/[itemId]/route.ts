import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canUpdateDemand } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const item = await prisma.demandChecklistItem.findUnique({
    where: { id: params.itemId },
    include: { demand: { include: { collaborators: { select: { userId: true } } } } },
  })
  if (!item || item.demandId !== params.id) return apiError('Item não encontrado', 404)

  const collaboratorUserIds = item.demand.collaborators.map((c) => c.userId)
  if (!canUpdateDemand(session, { ...item.demand, collaboratorUserIds })) {
    return apiError('Sem permissão', 403)
  }

  const body = await req.json()
  const data: any = {}
  if (body.isCompleted !== undefined) {
    data.isCompleted = body.isCompleted
    data.completedAt = body.isCompleted ? new Date() : null
  }
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null

  const updated = await prisma.demandChecklistItem.update({ where: { id: params.itemId }, data })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const item = await prisma.demandChecklistItem.findUnique({
    where: { id: params.itemId },
    include: { demand: { include: { collaborators: { select: { userId: true } } } } },
  })
  if (!item || item.demandId !== params.id) return apiError('Item não encontrado', 404)

  const collaboratorUserIds = item.demand.collaborators.map((c) => c.userId)
  if (!canUpdateDemand(session, { ...item.demand, collaboratorUserIds })) {
    return apiError('Sem permissão', 403)
  }

  await prisma.demandChecklistItem.delete({ where: { id: params.itemId } })
  return apiSuccess({ deleted: true })
}
