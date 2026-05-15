import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector } from '@/lib/permissions'
import { CreateMilestoneSchema } from '@/schemas/project.schema'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const project = await prisma.project.findUnique({ where: { id: params.id } })
  if (!project) return apiError('Projeto não encontrado', 404)
  if (!isDirector(session.user.role) && session.user.id !== project.responsibleId) {
    return apiError('Sem permissão', 403)
  }

  const body   = await req.json()
  const parsed = CreateMilestoneSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.errors)

  const d         = parsed.data
  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId:   params.id,
      title:       d.title,
      description: d.description ?? null,
      dueDate:     new Date(d.dueDate),
    },
  })

  return apiSuccess(milestone, 201)
}
