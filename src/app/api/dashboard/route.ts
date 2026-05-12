import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector } from '@/lib/permissions'
import { subDays } from 'date-fns'

// GET /api/dashboard
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  if (!isDirector(session.user.role)) {
    return apiError('Acesso restrito à diretoria', 403)
  }

  const today = new Date()
  const sevenDaysAgo = subDays(today, 7)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(today.getDate() + 7)

  // ─── Executa todas as queries em paralelo ───────────────────────────────
  const [
    overdueDemands,
    soonDemands,
    pendingEvidence,
    areas,
    criticalDemands,
    contractsAtRisk,
    decisionsNeeded,
  ] = await Promise.all([
    // Demandas vencidas
    prisma.demand.count({
      where: {
        isOverdue: true,
        status: { notIn: ['completed', 'cancelled'] },
      },
    }),

    // Demandas que vencem em até 7 dias
    prisma.demand.count({
      where: {
        dueDate: { gte: today, lte: sevenDaysFromNow },
        isOverdue: false,
        status: { notIn: ['completed', 'cancelled'] },
      },
    }),

    // Evidências pendentes
    prisma.evidenceRequest.count({
      where: { status: 'pending' },
    }),

    // Status por área
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        reports: {
          where: { status: 'published' },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: { publishedAt: true },
        },
        demands: {
          where: { status: { notIn: ['completed', 'cancelled'] } },
          select: { id: true, isOverdue: true },
        },
      },
    }),

    // Top demandas críticas (máx 5)
    prisma.demand.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
        OR: [
          { isOverdue: true },
          { priority: 'critical' },
        ],
      },
      orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        isOverdue: true,
        area: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
    }),

    // Contratos em risco ou atrasados
    prisma.contract.findMany({
      where: {
        status: { in: ['at_risk', 'delayed'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        number: true,
        name: true,
        client: true,
        status: true,
        riskNotes: true,
        area: { select: { id: true, name: true } },
      },
    }),

    // Reports com decisões necessárias (publicados)
    prisma.report.findMany({
      where: {
        status: 'published',
        hasDecisionNeeded: true,
        publishedAt: { gte: subDays(today, 30) },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        decisionsNeeded: true,
        publishedAt: true,
        area: { select: { id: true, name: true } },
      },
    }),
  ])

  // ─── Calcula status por área ──────────────────────────────────────────
  const areaStatus = areas.map((area) => {
    const lastReport = area.reports[0]
    const lastReportDate = lastReport?.publishedAt ?? null
    const activeDemands = area.demands.length
    const overdueDemandCount = area.demands.filter((d) => d.isOverdue).length

    const daysSinceLastReport = lastReportDate
      ? Math.floor((today.getTime() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

    let status: 'ok' | 'attention' | 'critical' = 'ok'
    if (overdueDemandCount > 0 || (daysSinceLastReport !== null && daysSinceLastReport > 14)) {
      status = 'critical'
    } else if (
      (daysSinceLastReport !== null && daysSinceLastReport > 7) ||
      activeDemands > 5
    ) {
      status = 'attention'
    }

    return {
      areaId: area.id,
      name: area.name,
      code: area.code,
      lastReportDate,
      daysSinceLastReport,
      activeDemands,
      overdueDemands: overdueDemandCount,
      status,
    }
  })

  // ─── Áreas sem atualização ────────────────────────────────────────────
  const inactiveAreas = areaStatus.filter(
    (a) => a.daysSinceLastReport === null || a.daysSinceLastReport > 7
  ).length

  return apiSuccess({
    alertCards: {
      overdueDemands,
      soonDemands,
      pendingEvidence,
      inactiveAreas,
    },
    areaStatus,
    criticalDemands,
    contractsAtRisk,
    decisionsNeeded: decisionsNeeded.map((r) => ({
      reportId: r.id,
      reportTitle: r.title,
      areaName: r.area.name,
      snippet: r.decisionsNeeded?.slice(0, 120) ?? '',
      publishedAt: r.publishedAt,
    })),
  })
}
