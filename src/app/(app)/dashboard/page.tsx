import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { subDays, startOfMonth, addDays } from 'date-fns'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { ArrowRightLeft, AlertTriangle, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role } = session.user
  const today = new Date()

  // Supervisor não tem dashboard — vai para sua área primária ou demandas
  if (role === 'supervisor' || role === 'viewer') {
    const primary = session.user.areaScopes.find((s) => s.isPrimary)
    if (primary) redirect(`/areas/${primary.areaId}`)
    redirect('/demandas')
  }

  const isDirector = ['master', 'director', 'admin'].includes(role)
  const isCoordinator = role === 'manager'

  // ─── DASHBOARD DO DIRETOR ──────────────────────────────────────────────────
  if (isDirector) {
    const monthStart = startOfMonth(today)

    const [
      overdueDemands,
      pendingEvidence,
      areas,
      criticalDemands,
      contractsAtRisk,
      decisionsNeeded,
      recentComments,
      totalContracts,
      activeContracts,
      interareaSlaAlerts,
      demandsLast30d,
      contractsExpiringSoon,
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
          _count: {
            select: { contracts: { where: { status: 'active' } } },
          },
        },
      }),
      prisma.demand.findMany({
        where: {
          status: { notIn: ['completed', 'cancelled'] },
          OR: [{ isOverdue: true }, { priority: 'critical' }],
        },
        orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
        take: 8,
        include: {
          area: { select: { name: true } },
          responsible: { select: { name: true } },
        },
      }),
      prisma.contract.findMany({
        where: { status: { in: ['at_risk', 'delayed'] } },
        take: 5,
        include: { area: { select: { name: true } } },
      }),
      prisma.report.findMany({
        where: {
          status: 'published',
          hasDecisionNeeded: true,
          publishedAt: { gte: subDays(today, 30) },
        },
        orderBy: { publishedAt: 'desc' },
        take: 4,
        include: { area: { select: { name: true } } },
      }),
      prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { author: { select: { name: true } } },
      }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'active' } }),
      // Demandas interárea com SLA em risco
      prisma.demand.findMany({
        where: {
          acceptanceStatus: 'pending_acceptance',
          slaStatus: { in: ['warning', 'breached'] },
        },
        take: 8,
        orderBy: { slaDeadline: 'asc' },
        include: {
          area: { select: { name: true } },
          requestingArea: { select: { name: true } },
        },
      }),
      // Demandas últimos 30 dias (para taxa de conclusão por área)
      prisma.demand.findMany({
        where: { createdAt: { gte: subDays(today, 30) } },
        select: { areaId: true, status: true },
      }),
      // Contratos vencendo nos próximos 30 dias
      prisma.contract.count({
        where: {
          status: { notIn: ['completed', 'suspended'] },
          endDate: { gte: today, lte: addDays(today, 30) },
        },
      }),
    ])

    // Taxa de conclusão por área (últimos 30 dias)
    const completionByArea = new Map<string, { total: number; completed: number }>()
    for (const d of demandsLast30d) {
      const curr = completionByArea.get(d.areaId) ?? { total: 0, completed: 0 }
      completionByArea.set(d.areaId, {
        total: curr.total + 1,
        completed: curr.completed + (d.status === 'completed' ? 1 : 0),
      })
    }

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
      const comp = completionByArea.get(area.id)
      const completionRate = comp && comp.total > 0
        ? Math.round((comp.completed / comp.total) * 100)
        : null
      return {
        ...area,
        lastReportDate: lastReport?.publishedAt ?? null,
        daysSinceLastReport: days,
        activeDemands: active,
        overdueCount: overdue,
        status,
        completionRate,
      }
    })

    const inactiveAreas = areaStatus.filter(
      (a) => a.daysSinceLastReport === null || a.daysSinceLastReport > 7
    ).length

    const contractStatusLabel: Record<string, string> = {
      at_risk: 'Em risco',
      delayed: 'Com atraso',
    }

    const statusDot: Record<string, string> = {
      critical: 'bg-red-500',
      attention: 'bg-amber-400',
      ok: 'bg-green-500',
    }
    const statusText: Record<string, string> = {
      critical: 'Crítico',
      attention: 'Atenção',
      ok: 'OK',
    }

    return (
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Executivo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Alertas principais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <AlertCard label="Demandas Vencidas" value={overdueDemands} color={overdueDemands > 0 ? 'red' : 'green'} href="/demandas?isOverdue=true" />
          <AlertCard label="Evidências Pendentes" value={pendingEvidence} color={pendingEvidence > 0 ? 'red' : 'green'} href="/evidencias" />
          <AlertCard label="Áreas sem Update" value={inactiveAreas} subtitle="> 7 dias" color={inactiveAreas > 0 ? 'amber' : 'green'} href="/areas" />
          <AlertCard label="Contratos em Risco" value={contractsAtRisk.length} color={contractsAtRisk.length > 0 ? 'amber' : 'green'} href="/contratos?status=at_risk" />
          <AlertCard label="SLA Interárea em Risco" value={interareaSlaAlerts.length} color={interareaSlaAlerts.length > 0 ? 'red' : 'green'} href="/relatorio-interarea" />
        </div>

        {/* Alerta de contratos vencendo */}
        {contractsExpiringSoon > 0 && (
          <Link
            href="/contratos"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors"
          >
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800 flex-1">
              {contractsExpiringSoon} contrato{contractsExpiringSoon !== 1 ? 's' : ''}{' '}
              vence{contractsExpiringSoon === 1 ? '' : 'm'} nos próximos 30 dias
            </span>
            <span className="text-xs text-amber-600">Ver contratos →</span>
          </Link>
        )}

        {/* Painel SLA Interárea */}
        {interareaSlaAlerts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                Aceites Interárea em Risco de SLA
              </h2>
              <Link href="/relatorio-interarea" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {interareaSlaAlerts.map((d) => (
                <Link key={d.id} href={`/demandas/${d.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.slaStatus === 'breached' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      {d.requestingArea?.name ?? '—'} → {d.area.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      d.slaStatus === 'breached'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {d.slaStatus === 'breached' ? 'Vencido' : 'Atenção'}
                    </span>
                    {d.slaDeadline && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(d.slaDeadline)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Painel de áreas */}
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
                    <td className="px-4 py-3">
                      <Link href={`/areas/${area.id}`} className="font-medium text-gray-800 hover:text-blue-600">
                        {area.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {area.lastReportDate
                        ? <span className={area.daysSinceLastReport! > 7 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                            há {area.daysSinceLastReport} dias
                          </span>
                        : <span className="text-red-500 font-medium">Nunca</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-gray-600">{area.activeDemands} ativas</span>
                      {area.overdueCount > 0 && (
                        <span className="ml-2 text-red-600 font-semibold">{area.overdueCount} vencidas</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                      {area._count.contracts} ativo{area._count.contracts !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {area.completionRate !== null ? (
                        <span className={`text-xs font-medium ${
                          area.completionRate >= 70 ? 'text-green-600' :
                          area.completionRate >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {area.completionRate}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot[area.status]}`} />
                        {statusText[area.status]}
                      </span>
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
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandas Críticas / Vencidas</h2>
              <Link href="/demandas" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {criticalDemands.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma demanda crítica</p>
              ) : criticalDemands.map((d) => (
                <Link key={d.id} href={`/demandas/${d.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <PriorityBadge priority={d.priority} />
                      <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                      <span className="text-xs text-gray-400">{d.area.name}</span>
                      {d.responsible && <span className="text-xs text-gray-400">· {d.responsible.name}</span>}
                    </div>
                  </div>
                  <span className={`text-xs flex-shrink-0 mt-1 font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                    {formatDate(d.dueDate)}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            {/* Contratos em risco */}
            {contractsAtRisk.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos em Atenção</h2>
                  <Link href="/contratos" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                  {contractsAtRisk.map((c) => (
                    <Link key={c.id} href={`/contratos/${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === 'at_risk' ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.number} · {c.area.name}</p>
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ${c.status === 'at_risk' ? 'text-red-600' : 'text-amber-600'}`}>
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
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aguardando Decisão</h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                  {decisionsNeeded.map((r) => (
                    <Link key={r.id} href={`/reports/${r.id}`}
                      className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
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

            {/* Interações recentes */}
            {recentComments.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Interações Recentes</h2>
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
              </section>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── DASHBOARD DO COORDENADOR ─────────────────────────────────────────────
  const areaIds = session.user.areaScopes.map((s) => s.areaId)
  if (areaIds.length === 0) redirect('/demandas')

  const monthStart = startOfMonth(today)
  const sevenDaysAgo = subDays(today, 7)

  const [
    areaData,
    contracts,
    openDemands,
    overdueDemands,
    demandsThisMonth,
    demandsCompletedThisMonth,
    pendingReports,
    recentReports,
    teamMembers,
  ] = await Promise.all([
    // Áreas do coordenador
    prisma.area.findMany({
      where: { id: { in: areaIds }, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    // Contratos das áreas
    prisma.contract.findMany({
      where: { areaId: { in: areaIds }, status: { not: 'closed' } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true, number: true, name: true, status: true,
        physicalProgress: true, financialProgress: true,
        endDate: true,
        area: { select: { name: true } },
      },
    }),
    // Demandas abertas
    prisma.demand.findMany({
      where: {
        areaId: { in: areaIds },
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
      take: 8,
      include: {
        responsible: { select: { name: true } },
        area: { select: { name: true } },
      },
    }),
    // Demandas vencidas
    prisma.demand.count({
      where: {
        areaId: { in: areaIds },
        isOverdue: true,
        status: { notIn: ['completed', 'cancelled'] },
      },
    }),
    // Demandas criadas este mês
    prisma.demand.count({
      where: { areaId: { in: areaIds }, createdAt: { gte: monthStart } },
    }),
    // Demandas concluídas este mês
    prisma.demand.count({
      where: {
        areaId: { in: areaIds },
        status: 'completed',
        updatedAt: { gte: monthStart },
      },
    }),
    // Reports rascunho ou sem publicação nos últimos 7 dias
    prisma.report.findMany({
      where: {
        areaId: { in: areaIds },
        OR: [
          { status: 'draft' },
          { status: 'published', publishedAt: { gte: sevenDaysAgo } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { author: { select: { name: true } }, area: { select: { name: true } } },
    }),
    // Reports publicados recentes
    prisma.report.findMany({
      where: { areaId: { in: areaIds }, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: { author: { select: { name: true } } },
    }),
    // Membros da equipe (supervisores) nas áreas
    prisma.userAreaScope.findMany({
      where: { areaId: { in: areaIds } },
      include: { user: { select: { id: true, name: true, role: true } } },
      distinct: ['userId'],
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
  const resolucaoMes = demandsThisMonth > 0
    ? Math.round((demandsCompletedThisMonth / demandsThisMonth) * 100)
    : null

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {areaData.length === 1 ? areaData[0].name : 'Meu Dashboard'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Olá, {session.user.name} ·{' '}
          {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AlertCard
          label="Demandas Vencidas"
          value={overdueDemands}
          color={overdueDemands > 0 ? 'red' : 'green'}
          href="/demandas?isOverdue=true"
        />
        <AlertCard
          label="Contratos Ativos"
          value={contracts.filter((c) => c.status === 'active').length}
          color="blue"
          href="/contratos"
        />
        <AlertCard
          label="Abertas no Mês"
          value={demandsThisMonth}
          color="gray"
          href="/demandas"
        />
        <AlertCard
          label="Resolvidas no Mês"
          value={demandsCompletedThisMonth}
          subtitle={resolucaoMes !== null ? `${resolucaoMes}%` : undefined}
          color={resolucaoMes !== null && resolucaoMes >= 70 ? 'green' : 'amber'}
          href="/demandas?status=completed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos</h2>
            <Link href="/contratos" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {contracts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum contrato ativo</p>
            ) : contracts.map((c) => (
              <Link key={c.id} href={`/contratos/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${contractStatusColor[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {contractStatusLabel[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{c.number} · {c.area.name}</p>
                  {/* Barra de progresso físico */}
                  {c.physicalProgress !== null && c.physicalProgress !== undefined && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(c.physicalProgress, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{c.physicalProgress?.toFixed(0)}% fís.</span>
                    </div>
                  )}
                </div>
                {c.endDate && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(c.endDate)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Demandas abertas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandas Abertas</h2>
            <Link href="/demandas" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {openDemands.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma demanda aberta</p>
            ) : openDemands.map((d) => (
              <Link key={d.id} href={`/demandas/${d.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <PriorityBadge priority={d.priority} />
                    <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                    {d.responsible && <span className="text-xs text-gray-400">{d.responsible.name}</span>}
                  </div>
                </div>
                <span className={`text-xs flex-shrink-0 mt-1 font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                  {formatDate(d.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Reports recentes / pendentes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reports Recentes</h2>
            <Link href={`/areas/${areaIds[0]}`} className="text-xs text-blue-600 hover:underline">Ver área</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {pendingReports.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum report recente</p>
            ) : pendingReports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
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

        {/* Equipe */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Equipe ({supervisors.length} supervisor{supervisors.length !== 1 ? 'es' : ''})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {supervisors.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum supervisor cadastrado</p>
            ) : supervisors.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 text-xs font-semibold">
                    {m.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{m.user.name}</p>
                  <p className="text-xs text-gray-400">Supervisor</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function AlertCard({
  label, value, subtitle, color, href,
}: {
  label: string
  value: number
  subtitle?: string
  color: 'red' | 'amber' | 'green' | 'blue' | 'gray'
  href: string
}) {
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
