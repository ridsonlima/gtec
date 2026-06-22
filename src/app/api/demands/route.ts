import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { CreateDemandSchema } from '@/schemas/demand.schema'
import { canCreateDemand, getUserAreaIds, canAccessArea } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'
import { notifyDemandAssigned, notifyCollaboratorAdded, notifyInterareaPendingAcceptance } from '@/lib/notifications'
import { getAusenciasMap } from '@/lib/ausencias'
import { computeDemandSignals } from '@/lib/demandSignals'
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
  const interarea = searchParams.get('interarea')
  const search = searchParams.get('search')
  const dueDateFrom = searchParams.get('dueDateFrom')
  const dueDateTo = searchParams.get('dueDateTo')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const skip = (page - 1) * limit

  const allowedAreaIds = getUserAreaIds(session)
  const where: any = {}

  // IDs de usuários que este usuário está cobrindo (cobertura de férias)
  const activeAusencias = await prisma.avisoAusencia.findMany({
    where: {
      substitutoId: session.user.id,
      ativo: true,
      OR: [{ dataFim: null }, { dataFim: { gte: new Date() } }],
    },
    select: { usuarioId: true },
  })
  const coveredUserIds = activeAusencias.map((a) => a.usuarioId)

  if (areaId) {
    if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)
    where.areaId = areaId
  } else if (allowedAreaIds) {
    // Colaborações do usuário para incluir demandas de outras áreas onde participa
    const collabDemandIds = await prisma.demandCollaborator
      .findMany({ where: { userId: session.user.id }, select: { demandId: true } })
      .then((r) => r.map((c) => c.demandId))

    const orClauses: any[] = [
      { areaId: { in: allowedAreaIds } },
      { requestingAreaId: { in: allowedAreaIds } },
    ]
    if (collabDemandIds.length > 0) {
      orClauses.push({ id: { in: collabDemandIds } })
    }
    // Inclui demandas dos usuários cobertos por este substituto
    if (coveredUserIds.length > 0) {
      orClauses.push({ responsibleId: { in: coveredUserIds } })
    }
    where.OR = orClauses
  } else if (coveredUserIds.length > 0) {
    // Diretor/admin sem filtro de área — mas ainda deve ver as cobertas
    // (eles já veem tudo, então coveredUserIds não restringe nada)
  }

  const openOnly = searchParams.get('openOnly')
  if (openOnly === 'true') where.status = { notIn: ['completed', 'cancelled'] }

  if (contractId) where.contractId = contractId
  if (status) where.status = status
  if (priority) where.priority = priority
  if (responsibleId) where.responsibleId = responsibleId
  if (isOverdue === 'true') where.isOverdue = true
  if (interarea === 'true') where.requestingAreaId = { not: null }
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
        updatedAt: true,
        requestingAreaId: true,
        acceptanceStatus: true,
        createdById: true,
        area: { select: { id: true, name: true, code: true } },
        requestingArea: { select: { id: true, name: true, code: true } },
        contract: { select: { id: true, number: true, name: true } },
        responsible: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true, collaborators: true } },
        updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.demand.count({ where }),
  ])

  // Mapa de ausências dos responsáveis (para sinalizar substituição a terceiros)
  const ausenciasMap = await getAusenciasMap(demands.map((d) => d.responsible?.id))

  // Mapa de "última visualização" do usuário → sinaliza cards com novidade
  const views = await prisma.demandView.findMany({
    where: { userId: session.user.id, demandId: { in: demands.map((d) => d.id) } },
    select: { demandId: true, viewedAt: true },
  })
  const viewMap = new Map(views.map((v) => [v.demandId, v.viewedAt]))

  // Marca quais demandas são cobertura de férias para este usuário + substituição
  const demandsWithCoverage = demands.map((d) => {
    const aus = d.responsible?.id ? ausenciasMap.get(d.responsible.id) : undefined
    const viewedAt = viewMap.get(d.id)
    const lastActivityAt = d.updates[0]?.createdAt ?? d.createdAt
    const signals = computeDemandSignals({
      status: d.status,
      dueDate: d.dueDate,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      lastActivityAt,
      viewedAt,
    })
    const { updates, ...rest } = d
    return {
      ...rest,
      coberturaInfo: coveredUserIds.includes(d.responsible?.id ?? '')
        ? { type: 'cobertura', nomeOriginal: d.responsible?.name ?? '' }
        : null,
      substituicaoInfo: aus ? { substitutoNome: aus.substitutoNome } : null,
      lastActivityAt,
      ...signals,
    }
  })

  return Response.json({
    data: demandsWithCoverage,
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

    // A área executora deve ser acessível ao criador (ou ele é director+)
    if (!canCreateDemand(session, data.areaId)) {
      return apiError('Sem permissão para criar demanda nesta área', 403)
    }

    // Se for interárea, a área solicitante deve ser diferente da executora
    if (data.requestingAreaId && data.requestingAreaId === data.areaId) {
      return apiError('Área solicitante deve ser diferente da área executora', 422)
    }

    // Calcula SLA de aceite para demandas interárea
    const SLA_HOURS: Record<string, number> = { critical: 4, high: 8, medium: 24, low: 48 }
    const isInterArea = Boolean(data.requestingAreaId)
    const slaDeadline = isInterArea
      ? new Date(Date.now() + (SLA_HOURS[data.priority] ?? 24) * 3600_000)
      : null

    const demand = await prisma.demand.create({
      data: {
        areaId: data.areaId,
        requestingAreaId: data.requestingAreaId ?? null,
        contractId: data.contractId ?? null,
        reportId: data.reportId ?? null,
        projectId: data.projectId ?? null,
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
        acceptanceStatus: isInterArea ? 'pending_acceptance' : null,
        slaDeadline,
        slaStatus: isInterArea ? 'ok' : null,
      },
      include: {
        area: { select: { id: true, name: true } },
        requestingArea: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Cria colaboradores iniciais (sem o responsável e sem o criador — eles já têm acesso)
    const collaboratorIds = (data.collaboratorIds ?? []).filter(
      (id) => id !== data.responsibleId && id !== session.user.id
    )
    if (collaboratorIds.length > 0) {
      await prisma.demandCollaborator.createMany({
        data: collaboratorIds.map((userId) => ({
          demandId: demand.id,
          userId,
          role: 'contributor',
          addedById: session.user.id,
        })),
        skipDuplicates: true,
      })
    }

    // Side effects assíncronos
    Promise.all([
      audit({
        userId: session.user.id,
        action: ACTIONS.DEMAND_CREATED,
        objectType: 'demand',
        objectId: demand.id,
        metadata: { title: data.title, areaId: data.areaId, requestingAreaId: data.requestingAreaId ?? null },
      }),
      data.responsibleId !== session.user.id
        ? notifyDemandAssigned(demand.id, demand.title, data.responsibleId, session.user.name)
        : Promise.resolve(),
      isInterArea && data.requestingAreaId
        ? notifyInterareaPendingAcceptance(demand.id, demand.title, data.areaId, demand.requestingArea?.name ?? 'Área solicitante')
        : Promise.resolve(),
      ...collaboratorIds.map((userId) =>
        notifyCollaboratorAdded(demand.id, demand.title, userId, session.user.name)
      ),
    ]).catch(console.error)

    return apiSuccess(demand, 201)
  } catch (e) {
    if (e instanceof ZodError) return apiError('Dados inválidos', 422, e.errors)
    console.error('[POST /api/demands]', e)
    return apiError('Erro interno', 500)
  }
}
