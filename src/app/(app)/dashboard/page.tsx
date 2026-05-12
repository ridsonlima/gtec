import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Apenas director e admin acessam o dashboard executivo
  if (!['director', 'admin'].includes(session.user.role)) {
    // Gestores são redirecionados para sua área primária
    const primary = session.user.areaScopes.find((s) => s.isPrimary)
    if (primary) redirect(`/areas/${primary.areaId}`)
    redirect('/demandas')
  }

  const today = new Date()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(today.getDate() + 7)

  // Queries paralelas para montar o dashboard
  const [
    overdueDemands,
    pendingEvidence,
    areas,
    criticalDemands,
    contractsAtRisk,
    decisionsNeeded,
  ] = await Promise.all([
    prisma.demand.count({
      where: { isOverdue: true, status: { notIn: ['completed', 'cancelled'] } },
    }),
    prisma.evidenceRequest.count({ where: { status: 'pending' } }),
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
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
    prisma.demand.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
        OR: [{ isOverdue: true }, { priority: 'critical' }],
      },
      orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
      take: 6,
      include: {
        area: { select: { name: true } },
        responsible: { select: { name: true } },
      },
    }),
    prisma.contract.findMany({
      where: { status: { in: ['at_risk', 'delayed'] } },
      take: 4,
      include: { area: { select: { name: true } } },
    }),
    prisma.report.findMany({
      where: { status: 'published', hasDecisionNeeded: true,
               publishedAt: { gte: subDays(today, 30) } },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      include: { area: { select: { name: true } } },
    }),
  ])

  const areaStatus = areas.map((area) => {
    const lastReport = area.reports[0]
    const days = lastReport?.publishedAt
      ? Math.floor((today.getTime() - lastReport.publishedAt.getTime()) / 86400000)
      : null
    const overdue = area.demands.filter((d) => d.isOverdue).length
    const active = area.demands.length
    const status =
      overdue > 0 || (days !== null && days > 14) ? 'critical'
      : (days !== null && days > 7) || active > 5 ? 'attention'
      : 'ok'
    return { ...area, lastReportDate: lastReport?.publishedAt ?? null, daysSinceLastReport: days, activeDemands: active, overdueCount: overdue, status }
  })

  const inactiveAreas = areaStatus.filter(
    (a) => a.daysSinceLastReport === null || a.daysSinceLastReport > 7
  ).length

  const statusIcon = { critical: '🔴', attention: '🟡', ok: '🟢' }
  const contractStatusLabel: Record<string, string> = { at_risk: 'Em risco', delayed: 'Com atraso' }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Executivo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Cards de alerta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AlertCard
          label="Demandas Vencidas"
          value={overdueDemands}
          color={overdueDemands > 0 ? 'red' : 'green'}
          href="/demandas?isOverdue=true"
        />
        <AlertCard
          label="Evidências Pendentes"
          value={pendingEvidence}
          color={pendingEvidence > 0 ? 'red' : 'green'}
          href="/evidencias"
        />
        <AlertCard
          label="Áreas sem Update"
          value={inactiveAreas}
          subtitle="> 7 dias"
          color={inactiveAreas > 0 ? 'amber' : 'green'}
          href="/areas"
        />
      </div>

      {/* Status por área */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Status por Área</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Área</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Último Report</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Demandas</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {areaStatus.map((area) => (
                <tr key={area.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/areas/${area.id}`} className="font-medium text-gray-800 hover:text-blue-600">
                      {area.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {area.lastReportDate
                      ? <span className={area.daysSinceLastReport! > 7 ? 'text-amber-600 font-medium' : ''}>
                          há {area.daysSinceLastReport} dias
                        </span>
                      : <span className="text-red-500">Nunca</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-gray-700">{area.activeDemands} ativas</span>
                    {area.overdueCount > 0 && (
                      <span className="ml-2 text-red-600 font-medium">{area.overdueCount} vencidas</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-base">{statusIcon[area.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demandas críticas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Demandas Críticas</h2>
            <Link href="/demandas" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {criticalDemands.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma demanda crítica 🎉</p>
            ) : criticalDemands.map((d) => (
              <Link key={d.id} href={`/demandas/${d.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <PriorityBadge priority={d.priority} />
                    <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                    <span className="text-xs text-gray-400">{d.area.name}</span>
                  </div>
                </div>
                <span className={`text-xs flex-shrink-0 mt-1 font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                  {formatDate(d.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Coluna direita */}
        <div className="space-y-6">
          {/* Contratos em risco */}
          {contractsAtRisk.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contratos em Atenção</h2>
                <Link href="/contratos" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {contractsAtRisk.map((c) => (
                  <Link key={c.id} href={`/contratos/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-base">{c.status === 'at_risk' ? '🔴' : '🟡'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.number} · {c.area.name}</p>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {contractStatusLabel[c.status] ?? c.status}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Decisões necessárias */}
          {decisionsNeeded.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Aguardando Decisão
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {decisionsNeeded.map((r) => (
                  <Link key={r.id} href={`/reports/${r.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        Decisão necessária
                      </span>
                      <span className="text-xs text-gray-400">{r.area.name}</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{r.decisionsNeeded}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(r.publishedAt)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function AlertCard({
  label, value, subtitle, color, href,
}: {
  label: string; value: number; subtitle?: string
  color: 'red' | 'amber' | 'green'; href: string
}) {
  const colors = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-green-200 bg-green-50 text-green-700',
  }
  const numColors = { red: 'text-red-600', amber: 'text-amber-600', green: 'text-green-600' }

  return (
    <Link href={href}
      className={`block rounded-xl border p-4 hover:shadow-sm transition-shadow ${colors[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <div className="flex items-end gap-1 mt-1">
        <span className={`text-3xl font-bold ${numColors[color]}`}>{value}</span>
        {subtitle && <span className="text-xs opacity-60 mb-1">{subtitle}</span>}
      </div>
    </Link>
  )
}
