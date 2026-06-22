import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import { subDays, startOfWeek, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { RelatoriosNav } from '@/components/shared/RelatoriosNav'

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isDirector(session.user.role)) redirect('/dashboard')

  const today        = new Date()
  const eightWeeksAgo = subDays(today, 56)
  const thirtyDaysAgo = subDays(today, 30)

  const [demands30d, interareaDemands, areas] = await Promise.all([
    prisma.demand.findMany({
      where: { createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true, status: true, updatedAt: true, areaId: true },
    }),
    prisma.demand.findMany({
      where: {
        requestingAreaId: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        acceptanceStatus: true,
        slaStatus: true,
        slaDeadline: true,
        acceptedAt: true,
        area: { select: { id: true, name: true } },
      },
    }),
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  // ── Gráfico 1: Volume semanal (últimas 8 semanas) ─────────────────────────
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(subDays(today, (7 - i) * 7), { weekStartsOn: 1 })
    const weekEnd   = subDays(startOfWeek(subDays(today, (6 - i) * 7), { weekStartsOn: 1 }), 0)
    const label     = format(weekStart, 'dd/MM', { locale: ptBR })
    const created   = demands30d.filter(
      (d) => new Date(d.createdAt) >= weekStart && new Date(d.createdAt) < subDays(weekEnd, -7)
    ).length
    const completed = demands30d.filter(
      (d) => d.status === 'completed' &&
        new Date(d.updatedAt) >= weekStart &&
        new Date(d.updatedAt) < subDays(weekEnd, -7)
    ).length
    return { label, created, completed }
  })

  const maxWeekly = Math.max(...weeks.flatMap((w) => [w.created, w.completed]), 1)

  // ── Gráfico 2: Taxa de conclusão por área (30 dias) ───────────────────────
  const completionByArea = areas.map((area) => {
    const areaDemands = demands30d.filter((d) => d.areaId === area.id)
    const total       = areaDemands.length
    const completed   = areaDemands.filter((d) => d.status === 'completed').length
    const rate        = total > 0 ? Math.round((completed / total) * 100) : null
    return { name: area.name, total, completed, rate }
  }).filter((a) => a.total > 0)

  const maxCompletion = Math.max(...completionByArea.map((a) => a.total), 1)

  // ── Gráfico 3: SLA Interárea por área executora (30 dias) ─────────────────
  const slaByArea = areas.map((area) => {
    const ads     = interareaDemands.filter((d) => d.area.id === area.id)
    const total   = ads.length
    if (total === 0) return null
    const onTime  = ads.filter((d) =>
      d.acceptanceStatus === 'accepted' &&
      d.slaDeadline &&
      d.acceptedAt &&
      new Date(d.acceptedAt) <= new Date(d.slaDeadline)
    ).length
    const breached = ads.filter((d) => d.slaStatus === 'breached').length
    const pending  = ads.filter((d) => d.acceptanceStatus === 'pending_acceptance').length
    const pct      = Math.round((onTime / total) * 100)
    return { name: area.name, total, onTime, breached, pending, pct }
  }).filter(Boolean) as { name: string; total: number; onTime: number; breached: number; pending: number; pct: number }[]

  // ── Tendência histórica por área (últimos 28d vs 28d anteriores) ──────────
  const ms28 = 28 * 86400000
  const limiteRecente = new Date(today.getTime() - ms28)
  const limiteAnterior = new Date(today.getTime() - 2 * ms28)

  const tendenciaPorArea = areas.map((area) => {
    const daArea = demands30d.filter((d) => d.areaId === area.id)
    const concluidasRecentes = daArea.filter((d) => d.status === 'completed' && new Date(d.updatedAt) >= limiteRecente).length
    const concluidasAnteriores = daArea.filter((d) => d.status === 'completed' && new Date(d.updatedAt) >= limiteAnterior && new Date(d.updatedAt) < limiteRecente).length
    const criadasRecentes = daArea.filter((d) => new Date(d.createdAt) >= limiteRecente).length
    const delta = concluidasRecentes - concluidasAnteriores
    return { name: area.name, concluidasRecentes, concluidasAnteriores, criadasRecentes, delta }
  }).filter((t) => t.concluidasRecentes > 0 || t.concluidasAnteriores > 0)
    .sort((a, b) => b.delta - a.delta)

  return (
    <div className="space-y-8">
      <RelatoriosNav active="tendencias" />
      <p className="text-sm text-gray-500 -mt-4">Visão consolidada de desempenho e tendências das áreas</p>

      {/* Gráfico 1: Volume semanal */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Volume de Demandas — Últimas 8 Semanas
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-end gap-2 h-40">
            {weeks.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                  <div
                    className="flex-1 bg-blue-400 rounded-t transition-all"
                    style={{ height: `${Math.max((w.created / maxWeekly) * 100, w.created > 0 ? 4 : 0)}%` }}
                    title={`Criadas: ${w.created}`}
                  />
                  <div
                    className="flex-1 bg-green-400 rounded-t transition-all"
                    style={{ height: `${Math.max((w.completed / maxWeekly) * 100, w.completed > 0 ? 4 : 0)}%` }}
                    title={`Concluídas: ${w.completed}`}
                  />
                </div>
                <span className="text-xs text-gray-400">{w.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400 inline-block" />Criadas</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block" />Concluídas</span>
          </div>
        </div>
      </section>

      {/* Gráfico 2: Taxa de conclusão por área */}
      {completionByArea.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Taxa de Conclusão por Área — Últimos 30 dias
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-3">
              {completionByArea
                .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
                .map((area, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <p className="text-sm text-gray-600 w-40 flex-shrink-0 truncate">{area.name}</p>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          (area.rate ?? 0) >= 70 ? 'bg-green-500' :
                          (area.rate ?? 0) >= 40 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${area.rate ?? 0}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-12 text-right ${
                      (area.rate ?? 0) >= 70 ? 'text-green-600' :
                      (area.rate ?? 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {area.rate ?? 0}%
                    </span>
                    <span className="text-xs text-gray-400 w-20 text-right">
                      {area.completed}/{area.total}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Tendência histórica por área */}
      {tendenciaPorArea.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Tendência de Conclusões por Área — Últimos 28 dias vs. período anterior
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {tendenciaPorArea.map((t, i) => {
              const subindo = t.delta > 0
              const descendo = t.delta < 0
              const TrendIcon = subindo ? TrendingUp : descendo ? TrendingDown : Minus
              const cor = subindo ? 'text-green-600' : descendo ? 'text-red-600' : 'text-gray-400'
              const bg  = subindo ? 'bg-green-50' : descendo ? 'bg-red-50' : 'bg-gray-50'
              return (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <p className="text-sm font-medium text-gray-700 flex-1 truncate">{t.name}</p>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Período anterior</p>
                    <p className="text-sm font-semibold text-gray-500">{t.concluidasAnteriores}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Últimos 28d</p>
                    <p className="text-sm font-bold text-gray-900">{t.concluidasRecentes}</p>
                  </div>
                  <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${bg} ${cor} w-20 justify-center`}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{t.delta > 0 ? `+${t.delta}` : t.delta}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">Verde = a área concluiu mais demandas que no período anterior. Foco no time, não em pessoas.</p>
        </section>
      )}

      {/* Gráfico 3: SLA Interárea */}
      {slaByArea.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Desempenho de SLA Interárea — Últimos 30 dias
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Área Executora</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Total</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">No Prazo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Vencido</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Pendente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slaByArea.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{row.name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.total}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{row.onTime}</td>
                    <td className="px-4 py-3 text-red-600 font-medium">{row.breached}</td>
                    <td className="px-4 py-3 text-amber-600">{row.pending}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${row.pct >= 80 ? 'bg-green-500' : row.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${row.pct >= 80 ? 'text-green-600' : row.pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {row.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Desempenho de SLA Interárea — Últimos 30 dias
          </h2>
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            Nenhuma demanda interárea nos últimos 30 dias
          </div>
        </section>
      )}
    </div>
  )
}
