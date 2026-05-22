import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessDemand, canUpdateDemand } from '@/lib/permissions'

async function getDemandOrFail(demandId: string, session: any) {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!demand) return { error: apiError('Demanda não encontrada', 404) }
  const collaboratorUserIds = demand.collaborators.map((c) => c.userId)
  if (!canAccessDemand(session, { ...demand, collaboratorUserIds })) return { error: apiError('Sem acesso', 403) }
  return { demand, collaboratorUserIds }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { error } = await getDemandOrFail(params.id, session)
  if (error) return error

  const items = await prisma.demandChecklistItem.findMany({
    where: { demandId: params.id },
    orderBy: { createdAt: 'asc' },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  return apiSuccess(items)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { error, demand, collaboratorUserIds } = await getDemandOrFail(params.id, session)
  if (error) return error

  if (!canUpdateDemand(session, { ...demand!, collaboratorUserIds: collaboratorUserIds! })) {
    return apiError('Sem permissão para editar esta demanda', 403)
  }

  const body = await req.json()
  if (!body.title?.trim()) return apiError('Título é obrigatório', 400)

  const item = await prisma.demandChecklistItem.create({
    data: {
      demandId: params.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  return apiSuccess(item, 201)
}
