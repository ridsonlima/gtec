import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import { computeDemandSignals } from '@/lib/demandSignals'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'
import { Activity, AlarmClock, Moon, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Row = {
  userId: string
  name: string
  areas: string
  ativas: number
  emDia: number
  estagnadas: number
  atrasadas: number
  bastanteAtrasadas: number
  ultimaEvolucao: Date | null
}

export default async function EngajamentoPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isDirector(session.user.role as any)) redirect('/dashboard')

  // Demandas ativas com a última evolução de cada uma
  const demands = await prisma.demand.findMany({
    where: { status: { notIn: ['completed', 'cancelled'] } },
    select: {
      id: true,
      status: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      responsible: { select: { id: true, name: true } },
      area: { select: { name: true } },
      updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })

  // Última evolução REGISTRADA por cada pessoa (autor do DemandUpdate)
  const lastByAuthor = await prisma.demandUpdate.groupBy({
    by: ['authorId'],
    _max: { createdAt: true },
  })
  const lastEvoMap = new Map(lastByAuthor.map((g) => [g.authorId, g._max.createdAt]))

  // Agrupa por responsável
  const byUser = new Map<string, Row & { _areas: Set<string> }>()
  for (const d of demands) {
    if (!d.responsible) continue
    const uid = d.responsible.id
    let row = byUser.get(uid)
    if (!row) {
      row = {
        userId: uid,
        name: d.responsible.name,
        areas: '',
        _areas: new Set<string>(),
        ativas: 0,
        emDia: 0,
        estagnadas: 0,
        atrasadas: 0,
        bastanteAtrasadas: 0,
        ultimaEvolucao: lastEvoMap.get(uid) ?? null,
      }
      byUser.set(uid, row)
    }
    if (d.area?.name) row._areas.add(d.area.name)

    const s = computeDemandSignals({
      status: d.status,
      dueDate: d.dueDate,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      lastActivityAt: d.updates[0]?.createdAt ?? d.createdAt,
    })
    row.ativas++
    if (s.isStale) row.estagnadas++
    else row.emDia++
    if (s.overdueLevel === 'late') row.atrasadas++
    if (s.overdueLevel === 'very_late') row.bastanteAtrasadas++
  }

  const rows = Array.from(byUser.values()).map((r) => ({ ...r, areas: Array.from(r._areas).join(', ') }))
  // Pior primeiro: mais bastante-atrasadas, depois atrasadas, depois estagnadas
  rows.sort(
    (a, b) =>
      b.bastanteAtrasadas - a.bastanteAtrasadas ||
      b.atrasadas - a.atrasadas ||
      b.estagnadas - a.estagnadas
  )

  // Totais gerais
  const tot = rows.reduce(
    (acc, r) => {
      acc.ativas += r.ativas
      acc.estagnadas += r.estagnadas
      acc.atrasadas += r.atrasadas + r.bastanteAtrasadas
      return acc
    },
    { ativas: 0, estagnadas: 0, atrasadas: 0 }
  )
  const pctEmDia = tot.ativas > 0 ? Math.round(((tot.ativas - tot.estagnadas) / tot.ativas) * 100) : 100

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Engajamento da Equipe
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Quem está mantendo as demandas vivas — atualização, estagnação e atraso por responsável.
        </p>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Demandas ativas" value={tot.ativas} icon={<Activity className="w-4 h-4" />} tone="gray" />
        <SummaryCard label="Em dia (7d)" value={`${pctEmDia}%`} icon={<CheckCircle2 className="w-4 h-4" />} tone="green" />
        <SummaryCard label="Estagnadas" value={tot.estagnadas} icon={<Moon className="w-4 h-4" />} tone="amber" />
        <SummaryCard label="Atrasadas" value={tot.atrasadas} icon={<AlarmClock className="w-4 h-4" />} tone="red" />
      </div>

      {/* Tabela por pessoa */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Responsável</th>
              <th className="px-3 py-2.5 font-medium text-center">Ativas</th>
              <th className="px-3 py-2.5 font-medium text-center">Em dia</th>
              <th className="px-3 py-2.5 font-medium text-center">Estagnadas</th>
              <th className="px-3 py-2.5 font-medium text-center">Atrasadas</th>
              <th className="px-4 py-2.5 font-medium">Última evolução registrada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">Nenhuma demanda ativa.</td></tr>
            )}
            {rows.map((r) => {
              const pct = r.ativas > 0 ? Math.round((r.emDia / r.ativas) * 100) : 100
              const atrasoTotal = r.atrasadas + r.bastanteAtrasadas
              const evoStale = !r.ultimaEvolucao || (Date.now() - new Date(r.ultimaEvolucao).getTime()) / 86400000 >= 7
              return (
                <tr key={r.userId} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{r.name}</p>
                    {r.areas && <p className="text-xs text-gray-400 truncate max-w-[220px]">{r.areas}</p>}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">{r.ativas}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-medium ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.estagnadas > 0
                      ? <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200">{r.estagnadas}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {atrasoTotal > 0
                      ? <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-xs font-semibold ${r.bastanteAtrasadas > 0 ? 'text-red-700 bg-red-50 border border-red-300' : 'text-orange-700 bg-orange-50 border border-orange-200'}`}>{atrasoTotal}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.ultimaEvolucao
                      ? <span className={evoStale ? 'text-amber-700' : 'text-gray-600'}>{timeAgo(r.ultimaEvolucao)}</span>
                      : <span className="text-red-600">nunca registrou</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Estagnada = sem evolução há 7+ dias. Atrasada = após o prazo (vermelho = 5+ dias).
        Veja o detalhe no <Link href="/demandas/pipeline" className="text-blue-600 hover:underline">Pipeline</Link>.
      </p>
    </div>
  )
}

function SummaryCard({ label, value, icon, tone }: {
  label: string; value: string | number; icon: React.ReactNode; tone: 'gray' | 'green' | 'amber' | 'red'
}) {
  const tones: Record<string, string> = {
    gray: 'text-gray-600', green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${tones[tone]} mb-1`}>
        {icon}{label}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
