import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { subDays, startOfMonth, addDays } from 'date-fns'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { ArrowRightLeft, AlertTriangle, Clock } from 'lucide-react'
import { DemandActivityFeed } from '@/components/dashboard/DemandActivityFeed'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import type { DashboardData } from '@/components/dashboard/DashboardGrid'
import type { WidgetId } from '@/lib/dashboard-prefs'

type SP = { tab?: string; status?: string; priority?: string; isOverdue?: string; areaId?: string }

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { role } = session.user
  const today = new Date()

  if (role === 'supervisor' || role === 'viewer') {
    const primary = session.user.areaScopes.find((s) => s.isPrimary)
    if (primary) redirect(`/areas/${primary.areaId}`)
    redirect('/demandas')
  }

  const isDirectorRole = ['master', 'director', 'admin'].includes(role)
  const isCoordinatorRole = role === 'manager'
  const tab = searchParams.tab ?? 'overview'

  // ─── DIRECTOR ─────────────────────────────────────────────────────────────
  if (isDirectorRole) {
    const TABS = [
      { key: 'overview',  label: 'Visão Geral' },
      { key: 'demandas',  label: 'Demandas' },
      { key: 'contratos', label: 'Contratos' },
      { key: 'projetos',  label: 'Projetos' },
      { key: 'reports',   label: 'Reports' },
    ]

    // ── Overview ──────────────────────────────────────────────────────────
    if (tab === 'overview') {
      const [
        overdueDemands, pendingEvidence, areas, criticalDemands,
        contractsAtRisk, decisionsNeeded, recentComments,
        interareaSlaAlerts, demandsLast30d, contractsExpiringSoon,
        recentUpdates,
      ] = await Promise.all([
        prisma.demand.count({ where: { isOverdue: true, status: { notIn: ['completed', 'cancelled'] } } }),
        prisma.evidenceRequest.count({ where: { status: 'pending' } }),
        prisma.area.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            reports: { where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 1, select: { publishedAt: true } },
            demands: { where: { status: { notIn: ['completed', 'cancelled'] } }, select: { id: true, isOverdue: true } },
            _count: { select: { contracts: { where: { status: 'active' } } } },
          },
        }),
        prisma.demand.findMany({
          where: { status: { notIn: ['completed', 'cancelled'] }, OR: [{ isOverdue: true }, { priority: 'critical' }] },
          orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
          take: 8,
          include: { area: { select: { name: true } }, responsible: { select: { name: true } } },
        }),
        prisma.contract.findMany({ where: { status: { in: ['at_risk', 'delayed'] } }, take: 5, include: { area: { select: { name: true } } } }),
        prisma.report.findMany({
          where: { status: 'published', hasDecisionNeeded: true, publishedAt: { gte: subDays(today, 30) } },
          orderBy: { publishedAt: 'desc' },
          take: 4,
          include: { area: { select: { name: true } } },
        }),
        prisma.comment.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { author: { select: { name: true } } } }),
        prisma.demand.findMany({
          where: { acceptanceStatus: 'pending_acceptance', slaStatus: { in: ['warning', 'breached'] } },
          take: 8,
          orderBy: { slaDeadline: 'asc' },
          include: { area: { select: { name: true } }, requestingArea: { select: { name: true } } },
        }),
        prisma.demand.findMany({ where: { createdAt: { gte: subDays(today, 30) } }, select: { areaId: true, status: true } }),
        prisma.contract.count({ where: { status: { notIn: ['completed', 'suspended'] }, endDate: { gte: today, lte: addDays(today, 30) } } }),
        prisma.demandUpdate.findMany({
          where: { content: { not: '' } },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            author: { select: { name: true } },
            demand: { select: { id: true, title: true, area: { select: { name: true } } } },
            views: { where: { userId: session.user.id }, select: { userId: true } },
          },
        }),
      ])

      const completionByArea = new Map<string, { total: number; completed: number }>()
      for (const d of demandsLast30d) {
        const curr = completionByArea.get(d.areaId) ?? { total: 0, completed: 0 }
        completionByArea.set(d.areaId, { total: curr.total + 1, completed: curr.completed + (d.status === 'completed' ? 1 : 0) })
      }

      const areaStatus = areas.map((area) => {
        const lastReport = area.reports[0]
        const days = lastReport?.publishedAt ? Math.floor((today.getTime() - lastReport.publishedAt.getTime()) / 86400000) : null
        const overdue = area.demands.filter((d) => d.isOverdue).length
        const active = area.demands.length
        const status = overdue > 0 || (days !== null && days > 14) ? 'critical' : (days !== null && days > 7) || active > 5 ? 'attention' : 'ok'
        const comp = completionByArea.get(area.id)
        const completionRate = comp && comp.total > 0 ? Math.round((comp.completed / comp.total) * 100) : null
        return { ...area, lastReportDate: lastReport?.publishedAt ?? null, daysSinceLastReport: days, activeDemands: active, overdueCount: overdue, status, completionRate }
      })

      const inactiveAreas = areaStatus.filter((a) => a.daysSinceLastReport === null || a.daysSinceLastReport > 7).length
      const statusDot: Record<string, string> = { critical: 'bg-red-500', attention: 'bg-amber-400', ok: 'bg-green-500' }
      const statusText: Record<string, string> = { critical: 'Crítico', attention: 'Atenção', ok: 'OK' }
      const contractStatusLabel: Record<string, string> = { at_risk: 'Em risco', delayed: 'Com atraso' }

      const feedItems = recentUpdates.map((u) => ({
        id: u.id,
        demandId: u.demand.id,
        demandTitle: u.demand.title,
        areaName: u.demand.area.name,
        authorName: u.author.name,
        content: u.content,
        statusAfter: u.statusAfter,
        createdAt: u.createdAt.toISOString(),
        seen: u.views.length > 0,
      }))
      const feedUnseenCount = feedItems.filter((i) => !i.seen).length

      // ── Build widget nodes (server-rendered, passed to client DashboardGrid) ──
      const widgets: Record<WidgetId, React.ReactNode> = {
        'alerts': (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Alertas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <AlertCard label="Demandas Vencidas" value={overdueDemands} color={overdueDemands > 0 ? 'red' : 'green'} href="/demandas?isOverdue=true" />
              <AlertCard label="Evidências Pendentes" value={pendingEvidence} color={pendingEvidence > 0 ? 'red' : 'green'} href="/evidencias" />
              <AlertCard label="Áreas sem Update" value={inactiveAreas} subtitle="> 7 dias" color={inactiveAreas > 0 ? 'amber' : 'green'} href="/areas" />
              <AlertCard label="Contratos em Risco" value={contractsAtRisk.length} color={contractsAtRisk.length > 0 ? 'amber' : 'green'} href="/contratos?status=at_risk" />
              <AlertCard label="SLA Interárea em Risco" value={interareaSlaAlerts.length} color={interareaSlaAlerts.length > 0 ? 'red' : 'green'} href="/relatorio-interarea" />
            </div>
          </section>
        ),

        'contracts-expiring': (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contratos Vencendo</h2>
            {contractsExpiringSoon > 0 ? (
              <Link href="/contratos" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-800 flex-1">
                  {contractsExpiringSoon} contrato{contractsExpiringSoon !== 1 ? 's' : ''} vence{contractsExpiringSoon === 1 ? '' : 'm'} nos próximos 30 dias
                </span>
                <span className="text-xs text-amber-600">Ver contratos →</span>
              </Link>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 flex items-center gap-3">
                <span className="text-sm text-gray-500">Nenhum contrato vencendo nos próximos 30 dias</span>
              </div>
            )}
          </section>
        ),

        'sla-interarea': (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />Aceites Interárea em Risco de SLA
              </h2>
              <Link href="/relatorio-interarea" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
            </div>
            {interareaSlaAlerts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                Nenhum aceite interárea em risco de SLA
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {interareaSlaAlerts.map((d) => (
                  <Link key={d.id} href={`/demandas/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.slaStatus === 'breached' ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />{d.requestingArea?.name ?? '—'} → {d.area.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.slaStatus === 'breached' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {d.slaStatus === 'breached' ? 'Vencido' : 'Atenção'}
                      </span>
                      {d.slaDeadline && <p className="text-xs text-gray-400 mt-0.5">{formatDate(d.slaDeadline)}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ),

        'area-status': (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Situação por Área</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Área</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Último Report</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Demandas</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Contratos</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Conclusão/30d</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {areaStatus.map((area) => (
                    <tr key={area.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><Link href={`/areas/${area.id}`} className="font-medium text-gray-800 hover:text-blue-600">{area.name}</Link></td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {area.lastReportDate
                          ? <span className={area.daysSinceLastReport! > 7 ? 'text-amber-600 font-medium' : 'text-gray-500'}>há {area.daysSinceLastReport} dias</span>
                          : <span className="text-red-500 font-medium">Nunca</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-gray-600">{area.activeDemands} ativas</span>
                        {area.overdueCount > 0 && <span className="ml-2 text-red-600 font-semibold">{area.overdueCount} vencidas</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500">{area._count.contracts} ativo{area._count.contracts !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {area.completionRate !== null
                          ? <span className={`text-xs font-medium ${area.completionRate >= 70 ? 'text-green-600' : area.completionRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{area.completionRate}%</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[area.status]}`} />{statusText[area.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ),

        'critical-demands': (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandas Críticas / Vencidas</h2>
              <Link href="/dashboard?tab=demandas" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {criticalDemands.length === 0
                ? <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma demanda crítica ou vencida</p>
                : criticalDemands.map((d) => (
                  <Link key={d.id} href={`/demandas/${d.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <PriorityBadge priority={d.priority} />
                        <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                        <span className="text-xs text-gray-400">{d.area.name}</span>
                        {d.responsible && <span className="text-xs text-gray-400">· {d.responsible.name}</span>}
                      </div>
                    </div>
                    <span className={`text-xs flex-shrink-0 mt-1 font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>{formatDate(d.dueDate)}</span>
                  </Link>
                ))}
            </div>
          </section>
        ),

        'activity-feed': (
          <DemandActivityFeed items={feedItems} unseenCount={feedUnseenCount} />
        ),

        'contracts-risk': (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos em Atenção</h2>
              {contractsAtRisk.length > 0 && <Link href="/dashboard?tab=contratos" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>}
            </div>
            {contractsAtRisk.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                Nenhum contrato em risco no momento
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {contractsAtRisk.map((c) => (
                  <Link key={c.id} href={`/contratos/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === 'at_risk' ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.number} · {c.area.name}</p>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0 ${c.status === 'at_risk' ? 'text-red-600' : 'text-amber-600'}`}>{contractStatusLabel[c.status] ?? c.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ),

        'awaiting-decision': (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aguardando Decisão</h2>
            {decisionsNeeded.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                Nenhum report aguardando decisão
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {decisionsNeeded.map((r) => (
                  <Link key={r.id} href={`/reports/${r.id}`} className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Decisão necessária</span>
                      <span className="text-xs text-gray-400">{r.area.name}</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{r.decisionsNeeded}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(r.publishedAt)}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ),

        'recent-comments': (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Interações Recentes</h2>
            {recentComments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                Nenhuma interação recente
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {recentComments.map((c) => (
                  <Link key={c.id}
                    href={`/${c.objectType === 'demand' ? 'demandas' : c.objectType === 'report' ? 'reports' : c.objectType === 'contract' ? 'contratos' : 'dashboard'}/${c.objectId}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-600">{c.author.name}</span>
                      <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{c.content}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ),
      }

      const dashData: DashboardData = {
        overdueDemands,
        pendingEvidence,
        inactiveAreas,
        contractsAtRiskCount: contractsAtRisk.length,
        interareaSlaAlertsCount: interareaSlaAlerts.length,
        contractsExpiringSoon,
        contractsExpiringHref: '/contratos',
        interareaSlaAlerts: interareaSlaAlerts.map((d) => ({
          id: d.id, title: d.title, areaName: d.area.name,
          requestingAreaName: d.requestingArea?.name ?? null,
          slaStatus: d.slaStatus, slaDeadline: d.slaDeadline ? new Date(d.slaDeadline).toISOString() : null,
        })),
        areaStatus: areaStatus.map((a) => ({
          id: a.id, name: a.name, daysSinceLastReport: a.daysSinceLastReport,
          activeDemands: a.activeDemands, overdueCount: a.overdueCount,
          completionRate: a.completionRate, contractsActive: a._count.contracts, status: a.status,
        })),
        criticalDemands: criticalDemands.map((d) => ({
          id: d.id, title: d.title, priority: d.priority, status: d.status,
          isOverdue: d.isOverdue, dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : '',
          areaName: d.area.name, responsibleName: d.responsible?.name ?? null,
        })),
        feedItems,
        feedUnseenCount,
        contractsAtRisk: contractsAtRisk.map((c) => ({
          id: c.id, name: c.name, number: c.number, areaName: c.area.name, status: c.status,
        })),
        decisionsNeeded: decisionsNeeded.map((r) => ({
          id: r.id, areaName: r.area.name,
          decisionsNeeded: r.decisionsNeeded,
          publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
        })),
        recentComments: recentComments.map((c) => ({
          id: c.id, objectType: c.objectType, objectId: c.objectId,
          authorName: c.author.name, content: c.content,
          createdAt: new Date(c.createdAt).toISOString(),
        })),
      }

      return (
        <div className="space-y-6">
          <DirectorHeader today={today} />
          <TabNav tabs={TABS} active={tab} />
          <DashboardGrid data={dashData} widgets={widgets} />
        </div>
      )
    }

    // ── Demandas tab ──────────────────────────────────────────────────────
    if (tab === 'demandas') {
      const statusFilter = searchParams.status
      const priorityFilter = searchParams.priority
      const isOverdueFilter = searchParams.isOverdue === 'true'
      const areaIdFilter = searchParams.areaId

      const demandWhere: any = {}
      if (statusFilter === 'completed') demandWhere.status = 'completed'
      else if (statusFilter === 'cancelled') demandWhere.status = 'cancelled'
      else if (statusFilter === 'all') { /* no filter */ }
      else demandWhere.status = { notIn: ['completed', 'cancelled'] }

      if (priorityFilter) demandWhere.priority = priorityFilter
      if (isOverdueFilter) demandWhere.isOverdue = true
      if (areaIdFilter) demandWhere.areaId = areaIdFilter

      const [demands, areas] = await Promise.all([
        prisma.demand.findMany({
          where: demandWhere,
          orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
          take: 60,
          include: { area: { select: { id: true, name: true } }, responsible: { select: { name: true } } },
        }),
        prisma.area.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
      ])

      const statusOpts = [
        { value: '', label: 'Ativas', href: `/dashboard?tab=demandas${priorityFilter ? `&priority=${priorityFilter}` : ''}${areaIdFilter ? `&areaId=${areaIdFilter}` : ''}` },
        { value: 'all', label: 'Todas', href: `/dashboard?tab=demandas&status=all${priorityFilter ? `&priority=${priorityFilter}` : ''}${areaIdFilter ? `&areaId=${areaIdFilter}` : ''}` },
        { value: 'completed', label: 'Concluídas', href: `/dashboard?tab=demandas&status=completed${priorityFilter ? `&priority=${priorityFilter}` : ''}${areaIdFilter ? `&areaId=${areaIdFilter}` : ''}` },
      ]
      const priorityOpts = [
        { value: '', label: 'Todas' },
        { value: 'critical', label: 'Crítica' },
        { value: 'high', label: 'Alta' },
        { value: 'medium', label: 'Média' },
        { value: 'low', label: 'Baixa' },
      ]

      return (
        <div className="space-y-6">
          <DirectorHeader today={today} />
          <TabNav tabs={TABS} active={tab} />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {statusOpts.map((o) => (
                <Link key={o.value} href={o.href}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    (statusFilter ?? '') === o.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}>{o.label}</Link>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {priorityOpts.map((o) => {
                const href = `/dashboard?tab=demandas${statusFilter ? `&status=${statusFilter}` : ''}${o.value ? `&priority=${o.value}` : ''}`
                return (
                  <Link key={o.value} href={href}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      (priorityFilter ?? '') === o.value ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}>{o.label}</Link>
                )
              })}
            </div>
            {isOverdueFilter ? (
              <Link href={`/dashboard?tab=demandas${statusFilter ? `&status=${statusFilter}` : ''}${priorityFilter ? `&priority=${priorityFilter}` : ''}`}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 border border-red-200">
                Só vencidas ×
              </Link>
            ) : (
              <Link href={`/dashboard?tab=demandas&isOverdue=true${statusFilter ? `&status=${statusFilter}` : ''}${priorityFilter ? `&priority=${priorityFilter}` : ''}`}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-red-300">
                Só vencidas
              </Link>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {areas.map((a) => (
                <Link key={a.id}
                  href={`/dashboard?tab=demandas${statusFilter ? `&status=${statusFilter}` : ''}${priorityFilter ? `&priority=${priorityFilter}` : ''}${isOverdueFilter ? '&isOverdue=true' : ''}&areaId=${a.id}`}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    areaIdFilter === a.id ? 'bg-gray-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>{a.name}</Link>
              ))}
              {areaIdFilter && (
                <Link href={`/dashboard?tab=demandas${statusFilter ? `&status=${statusFilter}` : ''}${priorityFilter ? `&priority=${priorityFilter}` : ''}${isOverdueFilter ? '&isOverdue=true' : ''}`}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-500">
                  Todas ×
                </Link>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">{demands.length} demanda{demands.length !== 1 ? 's' : ''}</p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Demanda</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Área</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Responsável</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Prazo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {demands.length === 0
                  ? <tr><td colSpan={5} className="px-4 py-8 text-sm text-gray-400 text-center">Nenhuma demanda encontrada</td></tr>
                  : demands.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/demandas/${d.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 block truncate max-w-xs">{d.title}</Link>
                        <PriorityBadge priority={d.priority} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{d.area.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{d.responsible?.name ?? '—'}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>{formatDate(d.dueDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} isOverdue={d.isOverdue} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Contratos tab ─────────────────────────────────────────────────────
    if (tab === 'contratos') {
      const statusFilter = searchParams.status

      const contractWhere: any = {}
      if (statusFilter && statusFilter !== 'all') contractWhere.status = statusFilter

      const [contracts, medicaoTotals] = await Promise.all([
        prisma.contract.findMany({
          where: contractWhere,
          orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
          include: {
            area: { select: { name: true } },
            contractPartners: {
              include: { empresaParceira: { select: { name: true } } },
              orderBy: { percentageTotal: 'desc' },
            },
          },
        }),
        prisma.medicao.groupBy({
          by: ['contractId'],
          _sum: { valorProduzido: true },
        }),
      ])

      const medicaoMap = new Map(medicaoTotals.map((m) => [m.contractId, m._sum.valorProduzido ?? 0]))

      const statusOpts = [
        { value: '', label: 'Todos' },
        { value: 'active', label: 'Ativos' },
        { value: 'at_risk', label: 'Em Risco' },
        { value: 'delayed', label: 'Atrasados' },
        { value: 'suspended', label: 'Suspensos' },
      ]

      const statusColor: Record<string, string> = {
        active:    'bg-green-100 text-green-700',
        at_risk:   'bg-red-100 text-red-700',
        delayed:   'bg-amber-100 text-amber-700',
        suspended: 'bg-gray-100 text-gray-500',
        completed: 'bg-blue-100 text-blue-700',
      }
      const statusLabel: Record<string, string> = {
        active:    'Ativo',
        at_risk:   'Em risco',
        delayed:   'Atrasado',
        suspended: 'Suspenso',
        completed: 'Concluído',
      }

      const totalValue = contracts.reduce((s, c) => s + (c.estimatedValue ?? 0), 0)
      const atRiskValue = contracts.filter((c) => c.status === 'at_risk' || c.status === 'delayed').reduce((s, c) => s + (c.estimatedValue ?? 0), 0)

      const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

      return (
        <div className="space-y-6">
          <DirectorHeader today={today} />
          <TabNav tabs={TABS} active={tab} />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Total em contratos</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(totalValue)}</p>
            </div>
            <div className={`border rounded-xl p-4 ${atRiskValue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs ${atRiskValue > 0 ? 'text-red-600' : 'text-gray-500'}`}>Valor em risco/atraso</p>
              <p className={`text-xl font-bold mt-1 ${atRiskValue > 0 ? 'text-red-700' : 'text-gray-900'}`}>{fmt(atRiskValue)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Contratos listados</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{contracts.length}</p>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {statusOpts.map((o) => (
              <Link key={o.value} href={`/dashboard?tab=contratos${o.value ? `&status=${o.value}` : ''}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  (statusFilter ?? '') === o.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                }`}>{o.label}</Link>
            ))}
          </div>

          <div className="space-y-2">
            {contracts.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">Nenhum contrato encontrado</div>
            ) : contracts.map((c) => {
              const medido = medicaoMap.get(c.id) ?? 0
              const medPct = c.estimatedValue && c.estimatedValue > 0 ? Math.min(Math.round((medido / c.estimatedValue) * 100), 100) : null
              const isPartner = c.executionModality === 'partner'

              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-200 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Linha principal */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/contratos/${c.id}`} className="text-sm font-semibold text-gray-800 hover:text-blue-600">{c.name}</Link>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${statusColor[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{statusLabel[c.status] ?? c.status}</span>
                        {isPartner && <span className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">Parceiro</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{c.number} · {c.area.name}{c.estimatedValue != null ? ` · ${fmt(c.estimatedValue)}` : ''}{c.endDate ? ` · até ${formatDate(c.endDate)}` : ''}</p>

                      {/* Barras de progresso */}
                      <div className="mt-2 space-y-1.5">
                        {c.physicalProgress !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 flex-shrink-0">Físico</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(c.physicalProgress ?? 0, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{c.physicalProgress?.toFixed(0)}%</span>
                          </div>
                        )}
                        {c.financialProgress !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 flex-shrink-0">Financeiro</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
                              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(c.financialProgress ?? 0, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{c.financialProgress?.toFixed(0)}%</span>
                          </div>
                        )}
                        {medPct !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 flex-shrink-0">Medido</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
                              <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${medPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{medPct}%</span>
                            <span className="text-xs text-gray-400">{fmt(medido)}</span>
                          </div>
                        )}
                      </div>

                      {/* Parceiros */}
                      {isPartner && c.contractPartners.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.contractPartners.map((cp) => (
                            <span key={cp.id} className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {cp.empresaParceira.name}
                              <span className="font-semibold">{cp.percentageTotal}%</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // ── Projetos tab ──────────────────────────────────────────────────────
    if (tab === 'projetos') {
      const projects = await prisma.project.findMany({
        where: { status: { in: ['planned', 'in_progress'] } },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: {
          responsibleUser: { select: { name: true } },
          milestones: { select: { isCompleted: true } },
        },
      })

      return (
        <div className="space-y-6">
          <DirectorHeader today={today} />
          <TabNav tabs={TABS} active={tab} />
          <p className="text-xs text-gray-400">{projects.length} projeto{projects.length !== 1 ? 's' : ''} ativo{projects.length !== 1 ? 's' : ''}</p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Projeto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Responsável</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Marcos</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Previsão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projects.length === 0
                  ? <tr><td colSpan={5} className="px-4 py-8 text-sm text-gray-400 text-center">Nenhum projeto ativo</td></tr>
                  : projects.map((p) => {
                      const done = p.milestones.filter((m) => m.isCompleted).length
                      const total = p.milestones.length
                      const pct = total > 0 ? Math.round((done / total) * 100) : null
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/projetos/${p.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600">{p.name}</Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{p.responsibleUser.name}</td>
                          <td className="px-4 py-3">
                            {total > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct ?? 0}%` }} />
                                </div>
                                <span className="text-xs text-gray-500">{done}/{total}</span>
                              </div>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-xs font-medium ${p.status === 'in_progress' ? 'text-amber-600' : 'text-blue-600'}`}>
                              {p.status === 'in_progress' ? 'Em andamento' : 'Planejado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                            {p.expectedEndDate ? formatDate(p.expectedEndDate) : '—'}
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Reports tab ───────────────────────────────────────────────────────
    if (tab === 'reports') {
      const areaIdFilter = searchParams.areaId

      const [reports, areas] = await Promise.all([
        prisma.report.findMany({
          where: { status: 'published', ...(areaIdFilter ? { areaId: areaIdFilter } : {}) },
          orderBy: { publishedAt: 'desc' },
          take: 40,
          include: { area: { select: { name: true } }, author: { select: { name: true } } },
        }),
        prisma.area.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
      ])

      return (
        <div className="space-y-6">
          <DirectorHeader today={today} />
          <TabNav tabs={TABS} active={tab} />

          <div className="flex gap-2 flex-wrap items-center">
            <Link href="/dashboard?tab=reports" className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!areaIdFilter ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>Todas as áreas</Link>
            {areas.map((a) => (
              <Link key={a.id} href={`/dashboard?tab=reports&areaId=${a.id}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${areaIdFilter === a.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                {a.name}
              </Link>
            ))}
          </div>

          <div className="space-y-2">
            {reports.length === 0
              ? <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">Nenhum report encontrado</div>
              : reports.map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-200 hover:bg-blue-50/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                      {r.hasDecisionNeeded && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">Decisão</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.area.name} · {r.author.name}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(r.publishedAt)}</span>
                </Link>
              ))}
          </div>
        </div>
      )
    }

    // Fallback to overview
    redirect('/dashboard')
  }

  // ─── COORDINATOR ───────────────────────────────────────────────────────────
  const areaIds = session.user.areaScopes.map((s) => s.areaId)
  if (areaIds.length === 0) redirect('/demandas')

  const COORD_TABS = [
    { key: 'overview',  label: 'Visão Geral' },
    { key: 'demandas',  label: 'Demandas' },
    { key: 'contratos', label: 'Contratos' },
  ]

  const monthStart = startOfMonth(today)
  const sevenDaysAgo = subDays(today, 7)

  // ── Coordinator overview ──────────────────────────────────────────────
  if (tab === 'overview') {
    const [
      areaData, contracts, openDemands, overdueDemands,
      demandsThisMonth, demandsCompletedThisMonth,
      pendingReports, teamMembers, recentUpdates,
    ] = await Promise.all([
      prisma.area.findMany({ where: { id: { in: areaIds }, isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, code: true } }),
      prisma.contract.findMany({
        where: { areaId: { in: areaIds }, status: { not: 'closed' } },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: { id: true, number: true, name: true, status: true, physicalProgress: true, financialProgress: true, endDate: true, area: { select: { name: true } } },
      }),
      prisma.demand.findMany({
        where: { areaId: { in: areaIds }, status: { notIn: ['completed', 'cancelled'] } },
        orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
        take: 8,
        include: { responsible: { select: { name: true } }, area: { select: { name: true } } },
      }),
      prisma.demand.count({ where: { areaId: { in: areaIds }, isOverdue: true, status: { notIn: ['completed', 'cancelled'] } } }),
      prisma.demand.count({ where: { areaId: { in: areaIds }, createdAt: { gte: monthStart } } }),
      prisma.demand.count({ where: { areaId: { in: areaIds }, status: 'completed', updatedAt: { gte: monthStart } } }),
      prisma.report.findMany({
        where: { areaId: { in: areaIds }, OR: [{ status: 'draft' }, { status: 'published', publishedAt: { gte: sevenDaysAgo } }] },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { author: { select: { name: true } }, area: { select: { name: true } } },
      }),
      prisma.userAreaScope.findMany({ where: { areaId: { in: areaIds } }, include: { user: { select: { id: true, name: true, role: true } } }, distinct: ['userId'] }),
      prisma.demandUpdate.findMany({
        where: { content: { not: '' }, demand: { areaId: { in: areaIds } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          author: { select: { name: true } },
          demand: { select: { id: true, title: true, area: { select: { name: true } } } },
          views: { where: { userId: session.user.id }, select: { userId: true } },
        },
      }),
    ])

    const contractStatusColor: Record<string, string> = {
      active:    'bg-green-100 text-green-700',
      at_risk:   'bg-red-100 text-red-700',
      delayed:   'bg-amber-100 text-amber-700',
      suspended: 'bg-gray-100 text-gray-500',
    }
    const contractStatusLabel: Record<string, string> = {
      active:    'Ativo',
      at_risk:   'Em risco',
      delayed:   'Com atraso',
      suspended: 'Suspenso',
    }

    const supervisors = teamMembers.filter((m) => m.user.role === 'supervisor')
    const resolucaoMes = demandsThisMonth > 0 ? Math.round((demandsCompletedThisMonth / demandsThisMonth) * 100) : null

    const coordFeedItems = recentUpdates.map((u) => ({
      id: u.id,
      demandId: u.demand.id,
      demandTitle: u.demand.title,
      areaName: u.demand.area.name,
      authorName: u.author.name,
      content: u.content,
      statusAfter: u.statusAfter,
      createdAt: u.createdAt.toISOString(),
      seen: u.views.length > 0,
    }))
    const coordFeedUnseenCount = coordFeedItems.filter((i) => !i.seen).length

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{areaData.length === 1 ? areaData[0].name : 'Meu Dashboard'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Olá, {session.user.name} · {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <TabNav tabs={COORD_TABS} active={tab} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AlertCard label="Demandas Vencidas" value={overdueDemands} color={overdueDemands > 0 ? 'red' : 'green'} href="/demandas?isOverdue=true" />
          <AlertCard label="Contratos Ativos" value={contracts.filter((c) => c.status === 'active').length} color="blue" href="/contratos" />
          <AlertCard label="Abertas no Mês" value={demandsThisMonth} color="gray" href="/demandas" />
          <AlertCard label="Resolvidas no Mês" value={demandsCompletedThisMonth} subtitle={resolucaoMes !== null ? `${resolucaoMes}%` : undefined} color={resolucaoMes !== null && resolucaoMes >= 70 ? 'green' : 'amber'} href="/demandas?status=completed" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos</h2>
              <Link href="/dashboard?tab=contratos" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {contracts.length === 0
                ? <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum contrato ativo</p>
                : contracts.map((c) => (
                  <Link key={c.id} href={`/contratos/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${contractStatusColor[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{contractStatusLabel[c.status] ?? c.status}</span>
                      </div>
                      <p className="text-xs text-gray-400">{c.number} · {c.area.name}</p>
                      {c.physicalProgress !== null && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(c.physicalProgress, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{c.physicalProgress?.toFixed(0)}% fís.</span>
                        </div>
                      )}
                    </div>
                    {c.endDate && <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(c.endDate)}</span>}
                  </Link>
                ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandas Abertas</h2>
              <Link href="/dashboard?tab=demandas" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {openDemands.length === 0
                ? <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma demanda aberta</p>
                : openDemands.map((d) => (
                  <Link key={d.id} href={`/demandas/${d.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <PriorityBadge priority={d.priority} />
                        <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                        {d.responsible && <span className="text-xs text-gray-400">{d.responsible.name}</span>}
                      </div>
                    </div>
                    <span className={`text-xs flex-shrink-0 mt-1 font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>{formatDate(d.dueDate)}</span>
                  </Link>
                ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reports Recentes</h2>
              <Link href={`/areas/${areaIds[0]}`} className="text-xs text-blue-600 hover:underline">Ver área</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {pendingReports.length === 0
                ? <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum report recente</p>
                : pendingReports.map((r) => (
                  <Link key={r.id} href={`/reports/${r.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-gray-400">{r.author.name}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-1">{timeAgo(r.createdAt)}</span>
                  </Link>
                ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Equipe ({supervisors.length} supervisor{supervisors.length !== 1 ? 'es' : ''})</h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {supervisors.length === 0
                ? <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum supervisor cadastrado</p>
                : supervisors.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 text-xs font-semibold">{m.user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{m.user.name}</p>
                      <p className="text-xs text-gray-400">Supervisor</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <div className="lg:col-span-2">
            <DemandActivityFeed items={coordFeedItems} unseenCount={coordFeedUnseenCount} />
          </div>
        </div>
      </div>
    )
  }

  // ── Coordinator: Demandas tab ─────────────────────────────────────────
  if (tab === 'demandas') {
    const statusFilter = searchParams.status
    const demandWhere: any = { areaId: { in: areaIds } }
    if (statusFilter === 'completed') demandWhere.status = 'completed'
    else demandWhere.status = { notIn: ['completed', 'cancelled'] }

    const demands = await prisma.demand.findMany({
      where: demandWhere,
      orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
      take: 50,
      include: { responsible: { select: { name: true } }, area: { select: { name: true } } },
    })

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meu Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Olá, {session.user.name} · {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <TabNav tabs={COORD_TABS} active={tab} />

        <div className="flex gap-1.5">
          <Link href="/dashboard?tab=demandas" className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!statusFilter ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>Ativas</Link>
          <Link href="/dashboard?tab=demandas&status=completed" className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'completed' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>Concluídas</Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Demanda</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Responsável</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Prazo</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {demands.length === 0
                ? <tr><td colSpan={4} className="px-4 py-8 text-sm text-gray-400 text-center">Nenhuma demanda</td></tr>
                : demands.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/demandas/${d.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 block truncate max-w-xs">{d.title}</Link>
                      <PriorityBadge priority={d.priority} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{d.responsible?.name ?? '—'}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>{formatDate(d.dueDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} isOverdue={d.isOverdue} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Coordinator: Contratos tab ─────────────────────────────────────────
  if (tab === 'contratos') {
    const contracts = await prisma.contract.findMany({
      where: { areaId: { in: areaIds }, status: { not: 'closed' } },
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
      include: { area: { select: { name: true } } },
    })

    const statusColor: Record<string, string> = {
      active:    'bg-green-100 text-green-700',
      at_risk:   'bg-red-100 text-red-700',
      delayed:   'bg-amber-100 text-amber-700',
      suspended: 'bg-gray-100 text-gray-500',
    }
    const statusLabel: Record<string, string> = {
      active:    'Ativo',
      at_risk:   'Em risco',
      delayed:   'Com atraso',
      suspended: 'Suspenso',
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meu Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Olá, {session.user.name} · {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <TabNav tabs={COORD_TABS} active={tab} />

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Contrato</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Avanço</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Término</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contracts.length === 0
                ? <tr><td colSpan={4} className="px-4 py-8 text-sm text-gray-400 text-center">Nenhum contrato</td></tr>
                : contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contratos/${c.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 block">{c.name}</Link>
                      <p className="text-xs text-gray-400">{c.number}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{statusLabel[c.status] ?? c.status}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.physicalProgress !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(c.physicalProgress ?? 0, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{c.physicalProgress?.toFixed(0)}%</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{c.endDate ? formatDate(c.endDate) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  redirect('/dashboard')
}

function DirectorHeader({ today }: { today: Date }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Dashboard Executivo</h1>
      <p className="text-sm text-gray-500 mt-0.5">
        {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

function TabNav({ tabs, active }: { tabs: { key: string; label: string }[]; active: string }) {
  return (
    <div className="flex gap-0.5 border-b border-gray-200 overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`/dashboard?tab=${t.key}`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
            active === t.key
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

function AlertCard({ label, value, subtitle, color, href }: { label: string; value: number; subtitle?: string; color: 'red' | 'amber' | 'green' | 'blue' | 'gray'; href: string }) {
  const styles = {
    red:   { card: 'border-red-200 bg-red-50',     num: 'text-red-600',    text: 'text-red-700' },
    amber: { card: 'border-amber-200 bg-amber-50', num: 'text-amber-600',  text: 'text-amber-700' },
    green: { card: 'border-green-200 bg-green-50', num: 'text-green-600',  text: 'text-green-700' },
    blue:  { card: 'border-blue-200 bg-blue-50',   num: 'text-blue-600',   text: 'text-blue-700' },
    gray:  { card: 'border-gray-200 bg-gray-50',   num: 'text-gray-700',   text: 'text-gray-600' },
  }
  const s = styles[color]
  return (
    <Link href={href} className={`block rounded-xl border p-4 hover:shadow-sm transition-shadow ${s.card}`}>
      <p className={`text-xs font-medium ${s.text} opacity-80`}>{label}</p>
      <div className="flex items-end gap-1.5 mt-1">
        <span className={`text-3xl font-bold leading-none ${s.num}`}>{value}</span>
        {subtitle && <span className={`text-xs mb-0.5 font-medium ${s.text} opacity-70`}>{subtitle}</span>}
      </div>
    </Link>
  )
}
