import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { CreateReportSchema } from '@/schemas/report.schema'
import { canAccessArea, getUserAreaIds } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'
import { notifyReportPublished } from '@/lib/notifications'
import { ZodError } from 'zod'

// GET /api/reports
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const areaId = searchParams.get('areaId')
  const contractId = searchParams.get('contractId')
  const status = searchParams.get('status')
  const hasCritical = searchParams.get('hasCritical')
  const hasDecision = searchParams.get('hasDecision')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const skip = (page - 1) * limit

  // Controle de acesso: director/admin vê tudo, outros veem apenas sua área
  const allowedAreaIds = getUserAreaIds(session)

  const where: any = {}

  // Filtro por área
  if (areaId) {
    if (!canAccessArea(session, areaId)) {
      return apiError('Sem acesso a esta área', 403)
    }
    where.areaId = areaId
  } else if (allowedAreaIds) {
    where.areaId = { in: allowedAreaIds }
  }

  if (contractId) where.contractId = contractId
  if (status) where.status = status
  if (hasCritical === 'true') where.hasCritical = true
  if (hasDecision === 'true') where.hasDecisionNeeded = true

  // Visibilidade de rascunhos: não-admin vê apenas publicados OU seus próprios rascunhos
  const draftFilter = !['master', 'admin', 'director'].includes(session.user.role)
    ? [{ status: { not: 'draft' } }, { authorId: session.user.id }]
    : null

  // Filtro de busca por texto
  const searchFilter = search
    ? [
        { title: { contains: search, mode: 'insensitive' as const } },
        { executiveSummary: { contains: search, mode: 'insensitive' as const } },
      ]
    : null

  // Combinar filtros OR sem sobrescrever: draft + search devem coexistir via AND
  if (draftFilter && searchFilter) {
    where.AND = [
      { OR: draftFilter },
      { OR: searchFilter },
    ]
  } else if (draftFilter) {
    where.OR = draftFilter
  } else if (searchFilter) {
    where.OR = searchFilter
  }

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        period: true,
        status: true,
        hasCritical: true,
        hasDecisionNeeded: true,
        publishedAt: true,
        createdAt: true,
        area: { select: { id: true, name: true, code: true } },
        contract: { select: { id: true, number: true, name: true } },
        author: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    }),
    prisma.report.count({ where }),
  ])

  return Response.json({
    data: reports,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

// POST /api/reports
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  // Managers, supervisores, admin e director podem criar reports
  if (!['manager', 'supervisor', 'admin', 'master', 'director'].includes(session.user.role)) {
    return apiError('Sem permissão para criar reports', 403)
  }

  try {
    const body = await req.json()
    const data = CreateReportSchema.parse(body)
    const shouldPublish = body.action === 'publish'

    // Verifica escopo de escrita na área
    if (!canAccessArea(session, data.areaId, true) && !['master', 'admin', 'director'].includes(session.user.role)) {
      return apiError('Sem permissão de escrita nesta área', 403)
    }

    const report = await prisma.report.create({
      data: {
        areaId: data.areaId,
        contractId: data.contractId ?? null,
        projectId: data.projectId ?? null,
        authorId: session.user.id,
        title: data.title,
        period: data.period,
        status: shouldPublish ? 'published' : 'draft',
        executiveSummary: data.executiveSummary,
        evolutions: data.evolutions,
        criticalPoints: data.criticalPoints,
        attentionPoints: data.attentionPoints,
        risks: data.risks,
        blockers: data.blockers,
        decisionsNeeded: data.decisionsNeeded,
        nextSteps: data.nextSteps,
        pendingItems: data.pendingItems,
        agendaSuggestion: data.agendaSuggestion,
        publishedAt: shouldPublish ? new Date() : null,
        hasCritical: !!(data.criticalPoints?.trim()),
        hasDecisionNeeded: !!(data.decisionsNeeded?.trim()),
      },
      include: {
        area: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    })

    if (shouldPublish) {
      await notifyReportPublished(report.id, report.title, session.user.name ?? 'Alguém').catch(console.error)
    }

    await audit({
      userId: session.user.id,
      action: shouldPublish ? ACTIONS.REPORT_PUBLISHED : ACTIONS.REPORT_CREATED,
      objectType: 'report',
      objectId: report.id,
    })

    return apiSuccess(report, 201)
  } catch (e) {
    if (e instanceof ZodError) return apiError('Dados inválidos', 422, e.errors)
    console.error('[POST /api/reports]', e)
    return apiError('Erro interno', 500)
  }
}
