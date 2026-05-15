import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canUpdateDemand } from '@/lib/permissions'
import { notifyCollaboratorAdded } from '@/lib/notifications'

async function resolveDemand(id: string) {
  return prisma.demand.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      areaId: true,
      requestingAreaId: true,
      responsibleId: true,
      collaborators: { select: { userId: true } },
    },
  })
}

// POST /api/demands/[id]/collaborators — adiciona colaborador
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await resolveDemand(params.id)
  if (!demand) return apiError('Demanda não encontrada', 404)

  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)
  if (!canUpdateDemand(session, { ...demand, collaboratorUserIds })) {
    return apiError('Sem permissão para gerenciar colaboradores', 403)
  }

  const body = await req.json()
  const { userId, role = 'contributor' } = body

  if (!userId) return apiError('userId é obrigatório', 400)
  if (!['contributor', 'observer'].includes(role)) return apiError('role inválido', 400)

  const user = await prisma.user.findUnique({ where: { id: userId, isActive: true }, select: { id: true, name: true } })
  if (!user) return apiError('Usuário não encontrado', 404)

  const collaborator = await prisma.demandCollaborator.upsert({
    where: { demandId_userId: { demandId: params.id, userId } },
    create: { demandId: params.id, userId, role, addedById: session.user.id },
    update: { role },
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  if (userId !== session.user.id) {
    notifyCollaboratorAdded(demand.id, demand.title, userId, session.user.name).catch(console.error)
  }

  return apiSuccess(collaborator, 201)
}

// DELETE /api/demands/[id]/collaborators?userId=xxx — remove colaborador
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const demand = await resolveDemand(params.id)
  if (!demand) return apiError('Demanda não encontrada', 404)

  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)
  if (!canUpdateDemand(session, { ...demand, collaboratorUserIds })) {
    return apiError('Sem permissão para gerenciar colaboradores', 403)
  }

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return apiError('userId é obrigatório', 400)

  await prisma.demandCollaborator.deleteMany({
    where: { demandId: params.id, userId },
  })

  return apiSuccess({ removed: true })
}
