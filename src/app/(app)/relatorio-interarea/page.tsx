import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { ArrowRightLeft } from 'lucide-react'
import { InterareaFilters } from './Filters'
import { RelatoriosNav } from '@/components/shared/RelatoriosNav'

const ACCEPTANCE_LABELS: Record<string, { label: string; cls: string }> = {
  pending_acceptance: { label: 'Aguardando',  cls: 'bg-amber-100 text-amber-700' },
  accepted:           { label: 'Aceita',      cls: 'bg-green-100 text-green-700' },
  rejected:           { label: 'Rejeitada',   cls: 'bg-red-100 text-red-700' },
}

const SLA_LABELS: Record<string, { label: string; cls: string }> = {
  ok:      { label: 'OK',       cls: 'bg-blue-50 text-blue-700' },
  warning: { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700' },
  breached:{ label: 'Vencido',  cls: 'bg-red-100 text-red-700' },
}

export default async function RelatorioInterareaPage({
  searchParams,
}: {
  searchParams: {
    requestingAreaId?: string
    areaId?: string
    status?: string
    acceptanceStatus?: string
    dateFrom?: string
    dateTo?: string
  }
}) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isDirector(session.user.role)) redirect('/dashboard')

  const requestingAreaId = searchParams.requestingAreaId ?? ''
  const areaId           = searchParams.areaId ?? ''
  const status           = searchParams.status ?? ''
  const acceptanceStatus = searchParams.acceptanceStatus ?? ''
  const dateFrom         = searchParams.dateFrom ?? ''
  const dateTo           = searchParams.dateTo ?? ''

  const [areas, demands] = await Promise.all([
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.demand.findMany({
      where: {
        requestingAreaId: { not: null },
        ...(requestingAreaId ? { requestingAreaId } : {}),
        ...(areaId ? { areaId } : {}),
        ...(status ? { status } : {}),
        ...(acceptanceStatus ? { acceptanceStatus } : {}),
        ...(dateFrom || dateTo ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo   ? { lte: new Date(dateTo + 'T23:59:59') } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        area:          { select: { name: true } },
        requestingArea:{ select: { name: true } },
        responsible:   { select: { name: true } },
      },
    }),
  ])

  // Métricas do conjunto filtrado
  const total     = demands.length
  const pending   = demands.filter((d) => d.acceptanceStatus === 'pending_acceptance').length
  const accepted  = demands.filter((d) => d.acceptanceStatus === 'accepted').length
  const rejected  = demands.filter((d) => d.acceptanceStatus === 'rejected').length
  const slaRisk   = demands.filter((d) => d.slaStatus === 'warning' || d.slaStatus === 'breached').length

  return (
    <div className="space-y-5">
      <RelatoriosNav active="interarea" />
      <p className="text-sm text-gray-500 -mt-3">Visão completa das solicitações entre áreas</p>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total" value={total} cls="text-gray-700" />
        <MiniStat label="Aguardando aceite" value={pending} cls={pending > 0 ? 'text-amber-600' : 'text-gray-500'} />
        <MiniStat label="Aceitas" value={accepted} cls="text-green-600" />
        <MiniStat label="SLA em risco" value={slaRisk} cls={slaRisk > 0 ? 'text-red-600' : 'text-gray-500'} />
      </div>

      {/* Filtros */}
      <InterareaFilters
        areas={areas}
        requestingAreaId={requestingAreaId}
        areaId={areaId}
        status={status}
        acceptanceStatus={acceptanceStatus}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Tabela */}
      {demands.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhuma demanda interárea encontrada com os filtros aplicados
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Demanda</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Fluxo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Aceite</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">SLA</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Responsável</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Prazo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden xl:table-cell">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {demands.map((d) => {
                  const acceptance = d.acceptanceStatus ? ACCEPTANCE_LABELS[d.acceptanceStatus] : null
                  const sla = d.slaStatus ? SLA_LABELS[d.slaStatus] : null

                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/demandas/${d.id}`} className="font-medium text-gray-800 hover:text-blue-600 line-clamp-1">
                          {d.title}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <PriorityBadge priority={d.priority} />
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="truncate max-w-[100px]">{d.requestingArea?.name ?? '—'}</span>
                          <ArrowRightLeft className="w-3 h-3 flex-shrink-0 text-gray-400" />
                          <span className="truncate max-w-[100px]">{d.area.name}</span>
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {acceptance ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${acceptance.cls}`}>
                            {acceptance.label}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {sla ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sla.cls}`}>
                            {sla.label}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                        {d.responsible.name}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {formatDate(d.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-400">
                        {formatDate(d.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {demands.length === 200 && (
            <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-100">
              Exibindo os 200 registros mais recentes. Use os filtros para refinar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  )
}
