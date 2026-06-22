import Link from 'next/link'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, DollarSign,
  ClipboardList, ArrowRightLeft, Camera, BarChart3,
} from 'lucide-react'

type Tone = 'red' | 'amber' | 'green' | 'blue' | 'slate' | 'purple'

const TONE: Record<Tone, { ring: string; chip: string; icon: string; value: string }> = {
  red:    { ring: 'from-red-500/10',    chip: 'bg-red-50',    icon: 'text-red-600',    value: 'text-red-600' },
  amber:  { ring: 'from-amber-500/10',  chip: 'bg-amber-50',  icon: 'text-amber-600',  value: 'text-amber-600' },
  green:  { ring: 'from-green-500/10',  chip: 'bg-green-50',  icon: 'text-green-600',  value: 'text-green-700' },
  blue:   { ring: 'from-blue-500/10',   chip: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-700' },
  purple: { ring: 'from-purple-500/10', chip: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  slate:  { ring: 'from-slate-500/10',  chip: 'bg-slate-100', icon: 'text-slate-600',  value: 'text-slate-800' },
}

export interface ExecKpi {
  id: string
  label: string
  value: string
  tone: Tone
  icon: 'overdue' | 'completion' | 'contract' | 'money' | 'sla' | 'evidence'
  href?: string
  trend?: { up: boolean; pct: number } | null
  sub?: string
}

const ICONS = {
  overdue: AlertTriangle, completion: CheckCircle2, contract: ClipboardList,
  money: DollarSign, sla: ArrowRightLeft, evidence: Camera,
}

interface Props {
  kpis: ExecKpi[]
  weekly: { label: string; criadas: number; concluidas: number }[]
  statusDist: { label: string; value: number; cls: string }[]
  areas: { id: string; name: string; status: string; activeDemands: number; overdueCount: number; completionRate: number | null; daysSinceLastReport: number | null }[]
}

const STATUS_DOT: Record<string, string> = { critical: 'bg-red-500', attention: 'bg-amber-400', ok: 'bg-green-500' }
const STATUS_TXT: Record<string, string> = { critical: 'Crítico', attention: 'Atenção', ok: 'OK' }

export function ExecutiveBI({ kpis, weekly, statusDist, areas }: Props) {
  const maxWeekly = Math.max(...weekly.flatMap((w) => [w.criadas, w.concluidas]), 1)
  const totalStatus = statusDist.reduce((a, s) => a + s.value, 0) || 1

  return (
    <div className="space-y-5">
      {/* ── KPIs grandes ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const t = TONE[k.tone]
          const Icon = ICONS[k.icon]
          const card = (
            <div className="relative bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 overflow-hidden elev-1 hover:elev-2 transition-all h-full">
              <div className={`absolute inset-0 bg-gradient-to-br ${t.ring} to-transparent pointer-events-none`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${t.chip} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${t.icon}`} />
                  </div>
                  {k.trend && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${k.trend.up ? 'text-green-600' : 'text-red-600'}`}>
                      {k.trend.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {k.trend.pct}%
                    </span>
                  )}
                </div>
                <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${t.value}`}>{k.value}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{k.label}</p>
                {k.sub && <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>}
              </div>
            </div>
          )
          return k.href ? <Link key={k.id} href={k.href}>{card}</Link> : <div key={k.id}>{card}</div>
        })}
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Volume semanal (criadas vs concluídas) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-5 elev-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" /> Demandas — últimas 8 semanas
            </h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />Criadas</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500 inline-block" />Concluídas</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-44">
            {weekly.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full flex gap-1 items-end" style={{ height: '150px' }}>
                  <div className="flex-1 bg-blue-500 rounded-t-md transition-all group-hover:bg-blue-600" style={{ height: `${Math.max((w.criadas / maxWeekly) * 100, w.criadas > 0 ? 4 : 0)}%` }} title={`Criadas: ${w.criadas}`} />
                  <div className="flex-1 bg-green-500 rounded-t-md transition-all group-hover:bg-green-600" style={{ height: `${Math.max((w.concluidas / maxWeekly) * 100, w.concluidas > 0 ? 4 : 0)}%` }} title={`Concluídas: ${w.concluidas}`} />
                </div>
                <span className="text-[10px] text-gray-400">{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Distribuição por status */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 elev-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Demandas abertas por status</h3>
          {statusDist.length === 0 || totalStatus === 0 ? (
            <p className="text-sm text-gray-400">Sem demandas abertas.</p>
          ) : (
            <div className="space-y-3">
              {statusDist.map((s, i) => {
                const pct = Math.round((s.value / totalStatus) * 100)
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">{s.label}</span>
                      <span className="font-semibold text-gray-800">{s.value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.cls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Situação por área ─────────────────────────────────────────────── */}
      {areas.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 elev-1 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Situação por área</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 text-left">
                  <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Área</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-center">Abertas</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-center">Vencidas</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-center">Conclusão</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-center">Últ. report</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {areas.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/areas/${a.id}`} className="font-medium text-gray-800 hover:text-blue-600">{a.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{a.activeDemands}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${a.overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{a.overdueCount}</td>
                    <td className="px-4 py-3 text-center">
                      {a.completionRate != null ? (
                        <span className={`font-semibold ${a.completionRate >= 70 ? 'text-green-600' : a.completionRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{a.completionRate}%</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {a.daysSinceLastReport == null ? <span className="text-red-500">nunca</span> : `${a.daysSinceLastReport}d`}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[a.status] ?? 'bg-gray-300'}`} />
                        {STATUS_TXT[a.status] ?? a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
