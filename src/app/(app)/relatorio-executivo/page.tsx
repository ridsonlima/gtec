import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import { subDays, addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatDate } from '@/lib/utils'
import { PrintButton } from '@/components/relatorio-executivo/PrintButton'
import { FileBarChart } from 'lucide-react'

export default async function RelatorioExecutivoPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isDirector(session.user.role)) redirect('/dashboard')

  const today        = new Date()
  const thirtyAgo    = subDays(today, 30)
  const in30         = addDays(today, 30)
  const reportDate   = format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })

  const [
    areas,
    overdueDemands,
    demandsLast30d,
    pendingEvidence,
    criticalDemands,
    contracts,
    projects,
    interareaSlaBreached,
  ] = await Promise.all([
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
        _count: { select: { contracts: { where: { status: 'active' } } } },
      },
    }),
    prisma.demand.count({
      where: { isOverdue: true, status: { notIn: ['completed', 'cancelled'] } },
    }),
    prisma.demand.findMany({
      where: { createdAt: { gte: thirtyAgo } },
      select: { status: true },
    }),
    prisma.evidenceRequest.count({ where: { status: 'pending' } }),
    prisma.demand.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
        OR: [{ isOverdue: true }, { priority: 'critical' }],
      },
      orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
      take: 10,
      include: {
        area:        { select: { name: true } },
        responsible: { select: { name: true } },
      },
    }),
    prisma.contract.findMany({
      where: { status: { notIn: ['completed', 'suspended'] } },
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
      include: { area: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { status: { in: ['planned', 'in_progress'] } },
      orderBy: { status: 'asc' },
      include: {
        responsibleUser: { select: { name: true } },
        milestones: { select: { isCompleted: true } },
      },
    }),
    prisma.demand.count({
      where: {
        requestingAreaId: { not: null },
        slaStatus: 'breached',
      },
    }),
  ])

  const totalDemands30    = demandsLast30d.length
  const completedDemands30 = demandsLast30d.filter((d) => d.status === 'completed').length
  const completionRate     = totalDemands30 > 0 ? Math.round((completedDemands30 / totalDemands30) * 100) : null

  const contractsExpiringSoon = contracts.filter(
    (c) => c.endDate && c.endDate >= today && c.endDate <= in30
  )
  const contractsAtRisk = contracts.filter((c) => c.status === 'at_risk' || c.status === 'delayed')

  const areaStatus = areas.map((area) => {
    const lastReport = area.reports[0]
    const days       = lastReport?.publishedAt
      ? Math.floor((today.getTime() - lastReport.publishedAt.getTime()) / 86400000)
      : null
    const overdue    = area.demands.filter((d) => d.isOverdue).length
    const active     = area.demands.length
    const status     =
      overdue > 0 || (days !== null && days > 14) ? 'Crítico'
      : (days !== null && days > 7) || active > 5 ? 'Atenção'
      : 'OK'
    return { ...area, daysSinceReport: days, overdueCount: overdue, activeDemands: active, status }
  })

  const STATUS_DOT: Record<string, string> = {
    'Crítico': 'bg-red-500',
    'Atenção': 'bg-amber-400',
    'OK':      'bg-green-500',
  }

  return (
    <div className="max-w-4xl space-y-8 print:space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart className="w-6 h-6 print:hidden" />
            Relatório Executivo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Referência: {reportDate} · Gerado por {session.user.name}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 print:text-black">
          Indicadores — Últimos 30 Dias
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Demandas Criadas" value={totalDemands30} color="blue" />
          <KpiCard label="Demandas Concluídas" value={completedDemands30} color="green" />
          <KpiCard label="Taxa de Conclusão" value={completionRate !== null ? `${completionRate}%` : '—'} color={completionRate !== null && completionRate >= 70 ? 'green' : 'amber'} />
          <KpiCard label="Demandas Vencidas" value={overdueDemands} color={overdueDemands > 0 ? 'red' : 'green'} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <KpiCard label="Evidências Pendentes" value={pendingEvidence} color={pendingEvidence > 0 ? 'amber' : 'green'} />
          <KpiCard label="Contratos em Risco" value={contractsAtRisk.length} color={contractsAtRisk.length > 0 ? 'amber' : 'green'} />
          <KpiCard label="Contratos Vencendo (30d)" value={contractsExpiringSoon.length} color={contractsExpiringSoon.length > 0 ? 'amber' : 'green'} />
          <KpiCard label="SLA Interárea Vencido" value={interareaSlaBreached} color={interareaSlaBreached > 0 ? 'red' : 'green'} />
        </div>
      </section>

      {/* Situação das Áreas */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 print:text-black">
          Situação por Área
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-gray-400">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Área</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Último Report</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Demandas Ativas</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Vencidas</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Contratos</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {areaStatus.map((area) => (
                <tr key={area.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{area.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {area.daysSinceReport !== null
                      ? <span className={area.daysSinceReport > 7 ? 'text-amber-600 font-medium' : ''}>
                          há {area.daysSinceReport}d
                        </span>
                      : <span className="text-red-500 font-medium">Nunca</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{area.activeDemands}</td>
                  <td className="px-4 py-3">
                    {area.overdueCount > 0
                      ? <span className="text-red-600 font-semibold">{area.overdueCount}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{area._count.contracts}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[area.status]}`} />
                      {area.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Demandas Críticas */}
      {criticalDemands.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 print:text-black">
            Demandas Críticas / Vencidas
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-gray-400">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Demanda</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Área</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Responsável</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Prazo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {criticalDemands.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{d.title}</td>
                    <td className="px-4 py-3 text-gray-500">{d.area.name}</td>
                    <td className="px-4 py-3 text-gray-500">{d.responsible?.name ?? '—'}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                      {formatDate(d.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      {d.isOverdue
                        ? <span className="text-xs font-bold text-red-600">VENCIDA</span>
                        : <span className="text-xs font-semibold text-amber-600">CRÍTICA</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Contratos com Atenção */}
      {(contractsAtRisk.length > 0 || contractsExpiringSoon.length > 0) && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 print:text-black">
            Contratos em Atenção
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-gray-400">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Contrato</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Área</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Término</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...contractsAtRisk, ...contractsExpiringSoon.filter((c) => !contractsAtRisk.find((r) => r.id === c.id))]
                  .map((c) => {
                    const daysUntil = c.endDate ? Math.ceil((c.endDate.getTime() - Date.now()) / 86400000) : null
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500">{c.area.name}</td>
                        <td className="px-4 py-3">
                          {c.status === 'at_risk' && <span className="text-xs font-semibold text-red-600">Em risco</span>}
                          {c.status === 'delayed' && <span className="text-xs font-semibold text-amber-600">Atrasado</span>}
                          {c.status === 'active' && daysUntil !== null && daysUntil <= 30 && (
                            <span className="text-xs font-semibold text-amber-600">Vence em {daysUntil}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {c.endDate ? formatDate(c.endDate) : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Projetos em Andamento */}
      {projects.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 print:text-black">
            Projetos em Andamento
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-gray-400">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Projeto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Responsável</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Marcos</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Previsão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projects.map((p) => {
                  const done  = p.milestones.filter((m) => m.isCompleted).length
                  const total = p.milestones.length
                  const pct   = total > 0 ? Math.round((done / total) * 100) : null
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.responsibleUser.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {total > 0 ? `${done}/${total} (${pct}%)` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${p.status === 'in_progress' ? 'text-amber-600' : 'text-blue-600'}`}>
                          {p.status === 'in_progress' ? 'Em andamento' : 'Planejado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.expectedEndDate ? formatDate(p.expectedEndDate) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Rodapé */}
      <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400 print:mt-8">
        Relatório gerado em {reportDate} · GTec — Sistema de Gestão Técnica
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: {
  label: string
  value: number | string
  color: 'blue' | 'green' | 'amber' | 'red'
}) {
  const map = {
    blue:  'bg-blue-50 border-blue-100 text-blue-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    red:   'bg-red-50 border-red-100 text-red-700',
  }
  return (
    <div className={`rounded-xl border p-4 text-center print:border-gray-300 ${map[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  )
}
