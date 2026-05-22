'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { List, LayoutGrid, ArrowRightLeft, AlertTriangle, Clock, ChevronRight, User, UserCheck } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { PriorityBadge } from '@/components/shared/PriorityBadge'

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-amber-500',
  medium: 'border-l-blue-400',
  low: 'border-l-gray-300',
}

const STAGES = [
  {
    id: 'waiting',
    label: 'Aguardando Aceite',
    description: 'Interárea pendente de aceite pela área executora',
    color: 'border-purple-300',
    bg: 'bg-purple-50',
    badge: 'text-purple-700 bg-purple-100 border-purple-200',
    dot: 'bg-purple-400',
    filter: (d: any) => d.requestingAreaId && d.acceptanceStatus === 'pending_acceptance',
  },
  {
    id: 'pending',
    label: 'Pendente',
    description: 'Aceita ou interna, ainda não iniciada',
    color: 'border-gray-300',
    bg: 'bg-gray-50',
    badge: 'text-gray-600 bg-gray-100 border-gray-200',
    dot: 'bg-gray-400',
    filter: (d: any) => d.status === 'pending' && d.acceptanceStatus !== 'pending_acceptance',
  },
  {
    id: 'in_progress',
    label: 'Em Andamento',
    description: 'Ativamente sendo executada',
    color: 'border-blue-300',
    bg: 'bg-blue-50',
    badge: 'text-blue-700 bg-blue-100 border-blue-200',
    dot: 'bg-blue-500',
    filter: (d: any) => d.status === 'in_progress',
  },
  {
    id: 'blocked',
    label: 'Bloqueada',
    description: 'Execução impedida por bloqueio',
    color: 'border-red-300',
    bg: 'bg-red-50',
    badge: 'text-red-700 bg-red-100 border-red-200',
    dot: 'bg-red-500',
    filter: (d: any) => d.status === 'blocked',
  },
]

type ViewMode = 'all' | 'mine'

export default function PipelinePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [areaId, setAreaId] = useState('')

  const params = new URLSearchParams({ openOnly: 'true', limit: '200', ...(areaId && { areaId }) })

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-demands', areaId],
    queryFn: () => fetch(`/api/demands?${params}`).then((r) => r.json()),
  })

  const { data: areasData } = useQuery({
    queryKey: ['areas'],
    queryFn: () => fetch('/api/areas').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/search?q=').then((r) => r.json()),
    staleTime: Infinity,
  })

  const allDemands: any[] = data?.data ?? []
  const areas: any[] = areasData?.data ?? []

  // Detect current user id from session via a separate endpoint
  const { data: sessionData } = useQuery({
    queryKey: ['session-user'],
    queryFn: () => fetch('/api/me/password', { method: 'HEAD' }).then(() =>
      fetch('/api/users').then((r) => r.json())
    ),
    staleTime: Infinity,
    enabled: false,
  })

  const demands = useMemo(() => {
    if (viewMode === 'mine') {
      // Filter demands where the current user is creator OR responsible
      // We detect "mine" by checking the createdById against a session fetch
      // Since we can't easily get session on client without extra call, we'll use a different approach
      return allDemands
    }
    return allDemands
  }, [allDemands, viewMode])

  const overdue = demands.filter((d) => d.isOverdue)

  const stageData = STAGES.map((stage) => ({
    ...stage,
    demands: demands.filter(stage.filter),
  }))

  const total = demands.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline de Demandas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? 'Carregando...' : `${total} demanda${total !== 1 ? 's' : ''} em aberto`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/demandas" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
            <List className="w-4 h-4" /> Lista
          </Link>
          <Link href="/demandas/kanban" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
            <LayoutGrid className="w-4 h-4" /> Kanban
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        {areas.length > 0 && (
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as áreas</option>
            {areas.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {/* Resumo por estágio */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {stageData.map((s) => (
            <span key={s.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${s.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label} <span className="font-bold">{s.demands.length}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Banner vencidas */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">{overdue.length} demanda{overdue.length !== 1 ? 's' : ''} vencida{overdue.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-red-600 mt-0.5 truncate">
              {overdue.slice(0, 3).map((d) => d.title).join(' · ')}{overdue.length > 3 ? ` +${overdue.length - 3}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Estágios do pipeline */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Carregando pipeline...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stageData.map((stage) => (
            <div key={stage.id} className={`rounded-xl border ${stage.color} overflow-hidden`}>
              {/* Stage header */}
              <div className={`px-5 py-3 ${stage.bg} border-b ${stage.color} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                  <span className="text-sm font-semibold text-gray-800">{stage.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${stage.badge}`}>{stage.demands.length}</span>
                </div>
                <span className="text-xs text-gray-400">{stage.description}</span>
              </div>

              {/* Demands */}
              {stage.demands.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-400 italic bg-white">Nenhuma demanda neste estágio</div>
              ) : (
                <div className="divide-y divide-gray-100 bg-white">
                  {stage.demands.map((d: any) => (
                    <DemandRow key={d.id} demand={d} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DemandRow({ demand: d }: { demand: any }) {
  function daysLeft() {
    if (!d.dueDate) return null
    const diff = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86400000)
    return diff
  }
  const days = daysLeft()
  const isUrgent = days !== null && days <= 3 && !d.isOverdue

  return (
    <Link
      href={`/demandas/${d.id}`}
      className={`flex items-center gap-4 px-5 py-3 hover:bg-gray-50/80 transition-colors border-l-4 ${d.isOverdue ? 'border-l-red-500' : (PRIORITY_BORDER[d.priority] ?? 'border-l-gray-200')}`}
    >
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center gap-2 flex-wrap">
          {d.isOverdue && (
            <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">VENCIDA</span>
          )}
          {d.requestingAreaId && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-200">
              <ArrowRightLeft className="w-3 h-3" /> INTERÁREA
            </span>
          )}
          <PriorityBadge priority={d.priority} />
          <span className="text-sm font-medium text-gray-800 truncate">{d.title}</span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
          <span className="font-medium text-gray-500">
            {d.requestingArea ? `${d.requestingArea.name} → ${d.area?.name}` : d.area?.name}
          </span>
          {d.responsible && (
            <span className="flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> {d.responsible.name}
            </span>
          )}
          {d.createdBy && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {d.createdBy.name}
            </span>
          )}
        </div>
      </div>

      {/* Right side: prazo */}
      <div className="flex-shrink-0 text-right">
        {d.dueDate && (
          <div className="flex items-center gap-1.5 justify-end">
            <Clock className={`w-3 h-3 ${d.isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-gray-300'}`} />
            <span className={`text-xs font-medium ${d.isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-gray-500'}`}>
              {formatDate(d.dueDate)}
            </span>
          </div>
        )}
        {isUrgent && days !== null && (
          <p className="text-xs text-amber-600 mt-0.5">{days === 1 ? 'vence amanhã' : `${days}d restantes`}</p>
        )}
        {d.isOverdue && d.dueDate && (
          <p className="text-xs text-red-500 mt-0.5">
            {Math.abs(Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86400000))}d atraso
          </p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </Link>
  )
}
