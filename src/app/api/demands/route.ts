import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { CreateDemandSchema } from '@/schemas/demand.schema'
import { canCreateDemand, getUserAreaIds, canAccessArea } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'
import { notifyDemandAssigned } from '@/lib/notifications'
import { ZodError } from 'zod'

// GET /api/demands
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const areaId = searchParams.get('areaId')
  const contractId = searchParams.get('contractId')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const responsibleId = searchParams.get('responsibleId')
  const isOverdue = searchParams.get('isOverdue')
  const search = searchParams.get('search')
  const dueDateFrom = searchParams.get('dueDateFrom')
  const dueDateTo = searchParams.get('dueDateTo')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const skip = (page - 1) * limit

  const allowedAreaIds = getUserAreaIds(session)
  const where: any = {}

  // Filtro de área
  if (areaId) {
    if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)
    where.areaId = areaId
  } else if (allowedAreaIds) {
    where.areaId = { in: allowedAreaIds }
  }

  if (contractId) where.contractId = contractId
  if (status) where.status = status
  if (priority) where.priority = priority
  if (responsibleId) where.responsibleId = responsibleId
  if (isOverdue === 'true') where.isOverdue = true
  if (dueDateFrom || dueDateTo) {
    where.dueDate = {}
    if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom)
    if (dueDateTo) where.dueDate.lte = new Date(dueDateTo)
  }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { context: { contains: search } },
    ]
  }

  const [demands, total] = await Promise.all([
    prisma.demand.findMany({
      where,
      orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        isOverdue: true,
        completedAt: true,
        origin: true,
        createdAt: true,
        area: { select: { id: true, name: true, code: true } },
        contract: { select: { id: true, number: true, name: true } },
        responsible: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    }),
    prisma.demand.count({ where }),
  ])

  return Response.json({
    data: demands,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

// POST /api/demands
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  try {
    const body = await req.json()
    const data = CreateDemandSchema.parse(body)

    if (!canCreateDemand(session, data.areaId)) {
      return apiError('Sem permissão para criar demanda nesta área', 403)
    }

    const demand = await prisma.demand.create({
      data: {
        areaId: data.areaId,
        contractId: data.contractId ?? null,
        reportId: data.reportId ?? null,
        title: data.title,
        context: data.context,
        responsibleId: data.responsibleId,
        createdById: session.user.id,
        status: 'pending',
        priority: data.priority,
        dueDate: new Date(data.dueDate),
        blockers: data.blockers,
        supportNeeded: data.supportNeeded,
        origin: data.origin,
      },
      include: {
        area: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Side effects
    Promise.all([
      audit({
        userId: session.user.id,
        action: ACTIONS.DEMAND_CREATED,
        objectType: 'demand',
        objectId: demand.id,
        metadata: { title: data.title, areaId: data.areaId },
      }),
      // Notifica responsável (se não for o próprio criador)
      data.responsibleId !== session.user.id
        ? notifyDemandAssigned(
            demand.id,
            demand.title,
            data.responsibleId,
            session.user.name
          )
        : Promise.resolve(),
    ]).catch(console.error)

    return apiSuccess(demand, 201)
  } catch (e) {
    if (e instanceof ZodError) return apiError('Dados inválidos', 422, e.errors)
    console.error('[POST /api/demands]', e)
    return apiError('Erro interno', 500)
  }
}
