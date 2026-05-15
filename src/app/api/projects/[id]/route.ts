import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector, isManagerOrAbove } from '@/lib/permissions'

type UserRole = 'master' | 'admin' | 'director' | 'manager' | 'supervisor' | 'viewer'
import { CreateProjectSchema } from '@/schemas/project.schema'
import { audit } from '@/lib/audit'

function canManage(session: { user: { id: string; role: UserRole } }, responsibleId: string) {
  return isDirector(session.user.role) || session.user.id === responsibleId
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem acesso', 403)

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      responsibleUser: { select: { id: true, name: true } },
      milestones:  { orderBy: { dueDate: 'asc' } },
      updates:     { orderBy: { createdAt: 'desc' }, include: { project: { select: { id: true } } } },
      demands:     {
        orderBy: { createdAt: 'desc' },
        include: {
          area: { select: { name: true } },
          responsible: { select: { name: true } },
        },
      },
    },
  })

  if (!project) return apiError('Projeto não encontrado', 404)
  if (!canManage(session, project.responsibleId) && !isDirector(session.user.role)) {
    return apiError('Sem acesso', 403)
  }

  return apiSuccess(project)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const project = await prisma.project.findUnique({ where: { id: params.id } })
  if (!project) return apiError('Projeto não encontrado', 404)
  if (!canManage(session, project.responsibleId)) return apiError('Sem permissão', 403)

  const body   = await req.json()
  const parsed = CreateProjectSchema.partial().safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.errors)

  const d       = parsed.data
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(d.name            !== undefined ? { name: d.name }                                     : {}),
      ...(d.objective       !== undefined ? { objective: d.objective }                           : {}),
      ...(d.responsibleId   !== undefined ? { responsibleId: d.responsibleId }                   : {}),
      ...(d.status          !== undefined ? { status: d.status }                                 : {}),
      ...(d.riskLevel       !== undefined ? { riskLevel: d.riskLevel }                           : {}),
      ...(d.startDate       !== undefined ? { startDate: d.startDate ? new Date(d.startDate) : null }             : {}),
      ...(d.expectedEndDate !== undefined ? { expectedEndDate: d.expectedEndDate ? new Date(d.expectedEndDate) : null } : {}),
    },
  })

  await audit({ userId: session.user.id, action: 'project.update', objectType: 'project', objectId: params.id })
  return apiSuccess(updated)
}
