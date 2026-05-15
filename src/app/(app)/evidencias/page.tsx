import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { Eye, CheckCircle2, Clock, AlertCircle, Filter } from 'lucide-react'
import { EvidenciaActions } from '@/components/evidencias/EvidenciaActions'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pendente',  color: 'text-amber-700 bg-amber-50 border-amber-200',   icon: <Clock className="w-3.5 h-3.5" /> },
  received: { label: 'Recebida',  color: 'text-green-700 bg-green-50 border-green-200',   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: 'Rejeitada', color: 'text-red-700 bg-red-50 border-red-200',         icon: <AlertCircle className="w-3.5 h-3.5" /> },
}

export default async function EvidenciasPage({
  searchParams,
}: {
  searchParams: { status?: string; tab?: string }
}) {
  const session = await auth()
  if (!session) return null

  const areaIds     = getUserAreaIds(session)
  const statusFilter = searchParams.status ?? ''
  const tab          = searchParams.tab ?? 'all'
  const userId       = session.user.id

  const baseWhere: any = {
    ...(areaIds ? {
      OR: [
        { reportRef: { areaId: { in: areaIds } } },
        { demandRef: { areaId: { in: areaIds } } },
      ],
    } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  let tabFilter: any = {}
  if (tab === 'mine')      tabFilter = { requestedById: userId }
  if (tab === 'assigned')  tabFilter = { responsibleId: userId }

  const evidenceRequests = await prisma.evidenceRequest.findMany({
    where: { ...baseWhere, ...tabFilter },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 80,
    include: {
      responsible: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
      reportRef:   { select: { id: true, title: true, area: { select: { name: true } } } },
      demandRef:   { select: { id: true, title: true } },
    },
  })

  const [countPending, countMine] = await Promise.all([
    prisma.evidenceRequest.count({
      where: { ...baseWhere, status: 'pending' },
    }),
    prisma.evidenceRequest.count({
      where: { ...baseWhere, requestedById: userId },
    }),
  ])

  const TABS = [
    { key: 'all',      label: 'Todas' },
    { key: 'mine',     label: 'Que solicitei', count: countMine },
    { key: 'assigned', label: 'Atribuídas a mim' },
  ]

  const STATUS_OPTIONS = [
    { value: '', label: 'Todos os status' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'received', label: 'Recebidas' },
    { value: 'rejected', label: 'Rejeitadas' },
  ]

  function buildHref(params: Record<string, string>) {
    const p = new URLSearchParams()
    if (params.tab && params.tab !== 'all') p.set('tab', params.tab)
    if (params.status) p.set('status', params.status)
    const s = p.toString()
    return `/evidencias${s ? '?' + s : ''}`
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Evidências
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pedidos de evidências e comprovações
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-4 text-center ${countPending > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
          <p className={`text-2xl font-bold ${countPending > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
            {countPending}
          </p>
          <p className={`text-xs mt-0.5 ${countPending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>Pendentes</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {evidenceRequests.filter((e) => e.status === 'received').length}
          </p>
          <p className="text-xs text-green-600 mt-0.5">Recebidas</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">
            {evidenceRequests.filter((e) => e.status === 'rejected').length}
          </p>
          <p className="text-xs text-red-600 mt-0.5">Rejeitadas</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const isActive = tab === t.key
          return (
            <Link
              key={t.key}
              href={buildHref({ tab: t.key, status: statusFilter })}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {t.count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Filtro de status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((o) => (
            <Link
              key={o.value}
              href={buildHref({ tab, status: o.value })}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === o.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Lista */}
      {evidenceRequests.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhum pedido de evidência encontrado
        </div>
      ) : (
        <div className="space-y-2">
          {evidenceRequests.map((ev) => {
            const config    = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pending
            const target    = ev.reportRef ?? ev.demandRef
            const targetHref = ev.reportRef
              ? `/reports/${ev.reportRef.id}`
              : ev.demandRef
              ? `/demandas/${ev.demandRef.id}`
              : '#'
            const isOverdue = ev.status === 'pending' && ev.dueDate && new Date(ev.dueDate) < new Date()
            const isRequester = ev.requestedById === userId

            return (
              <div
                key={ev.id}
                className={`bg-white rounded-xl border px-5 py-4 ${isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-100'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </span>
                      {isOverdue && (
                        <span className="text-xs font-bold text-red-600">VENCIDA</span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{ev.description}</p>

                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                      <span>Solicitado por <strong>{ev.requestedBy.name}</strong></span>
                      <span>Para <strong>{ev.responsible.name}</strong></span>
                      {ev.dueDate && (
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          Prazo: {formatDate(ev.dueDate)}
                        </span>
                      )}
                    </div>

                    {ev.responseNotes && ev.status !== 'pending' && (
                      <p className="mt-1.5 text-xs text-gray-500 italic bg-gray-50 rounded px-2 py-1">
                        "{ev.responseNotes}"
                      </p>
                    )}

                    {target && (
                      <Link href={targetHref} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        {ev.reportRef?.area?.name && `${ev.reportRef.area.name} · `}
                        {target.title}
                      </Link>
                    )}

                    {/* Ação rápida */}
                    <EvidenciaActions
                      evidenceId={ev.id}
                      currentStatus={ev.status}
                      isRequester={isRequester}
                    />
                  </div>

                  <div className="flex-shrink-0 text-right text-xs text-gray-400">
                    <p>{timeAgo(new Date(ev.createdAt))}</p>
                    <Link href={targetHref} className="text-blue-600 hover:underline mt-1 block">
                      Ver →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
