import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; milestoneId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const project = await prisma.project.findUnique({ where: { id: params.id } })
  if (!project) return apiError('Projeto não encontrado', 404)
  if (!isDirector(session.user.role) && session.user.id !== project.responsibleId) {
    return apiError('Sem permissão', 403)
  }

  const body        = await req.json()
  const isCompleted = typeof body.isCompleted === 'boolean' ? body.isCompleted : undefined

  const updated = await prisma.projectMilestone.update({
    where: { id: params.milestoneId },
    data: {
      ...(isCompleted !== undefined ? {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      } : {}),
      ...(body.title       !== undefined ? { title: body.title }             : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.dueDate     !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
    },
  })

  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; milestoneId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const project = await prisma.project.findUnique({ where: { id: params.id } })
  if (!project) return apiError('Projeto não encontrado', 404)
  if (!isDirector(session.user.role) && session.user.id !== project.responsibleId) {
    return apiError('Sem permissão', 403)
  }

  await prisma.projectMilestone.delete({ where: { id: params.milestoneId } })
  return apiSuccess({ deleted: true })
}
