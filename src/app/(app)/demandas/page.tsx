'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Filter, ArrowRightLeft, LayoutGrid } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas as prioridades' },
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

export default function DemandasPage() {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [isOverdue, setIsOverdue] = useState(false)
  const [interarea, setInterarea] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({
    ...(status && { status }),
    ...(priority && { priority }),
    ...(isOverdue && { isOverdue: 'true' }),
    ...(interarea && { interarea: 'true' }),
    ...(search && { search }),
    page: String(page),
    limit: '20',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['demands', status, priority, isOverdue, interarea, search, page],
    queryFn: () =>
      fetch(`/api/demands?${params}`).then((r) => r.json()),
  })

  const demands = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const priorityBorder: Record<string, string> = {
    critical: 'border-l-red-500',
    high: 'border-l-amber-500',
    medium: 'border-l-blue-400',
    low: 'border-l-gray-300',
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Demandas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total} demanda${total !== 1 ? 's' : ''}` : 'Nenhuma demanda'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/demandas/kanban"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200
                       text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            Kanban
          </Link>
          <Link
            href="/demandas/nova"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white
                       text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Demanda
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filtros</span>
          </div>

          <input
            type="text"
            placeholder="Buscar demanda..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1) }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isOverdue}
              onChange={(e) => { setIsOverdue(e.target.checked); setPage(1) }}
              className="rounded border-gray-300 text-red-500 focus:ring-red-400"
            />
            Apenas vencidas
          </label>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={interarea}
              onChange={(e) => { setInterarea(e.target.checked); setPage(1) }}
              className="rounded border-gray-300 text-purple-500 focus:ring-purple-400"
            />
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />
            Interárea
          </label>

          {(status || priority || isOverdue || interarea || search) && (
            <button
              onClick={() => { setStatus(''); setPriority(''); setIsOverdue(false); setInterarea(false); setSearch(''); setPage(1) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Carregando demandas...</p>
        </div>
      ) : demands.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 font-medium">Nenhuma demanda encontrada</p>
          <p className="text-sm text-gray-400 mt-1">Tente ajustar os filtros ou crie uma nova demanda</p>
          <Link
            href="/demandas/nova"
            className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 bg-blue-600 text-white
                       text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Demanda
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {demands.map((d: any) => (
            <Link
              key={d.id}
              href={`/demandas/${d.id}`}
              className={cn(
                'block bg-white rounded-xl border border-gray-200 border-l-4 px-4 py-3',
                'hover:shadow-sm transition-shadow',
                d.isOverdue ? 'border-l-red-500' : (priorityBorder[d.priority] ?? 'border-l-gray-200')
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.isOverdue && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        VENCIDA
                      </span>
                    )}
                    {d.requestingAreaId && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-200">
                        <ArrowRightLeft className="w-3 h-3" />
                        INTERÁREA
                      </span>
                    )}
                    <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <PriorityBadge priority={d.priority} />
                    <StatusBadge status={d.status} />
                    <span className="text-xs text-gray-400">
                      {d.requestingArea ? `${d.requestingArea.name} → ${d.area?.name}` : d.area?.name}
                    </span>
                    {d.contract && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {d.contract.number}
                      </span>
                    )}
                    {d._count?.comments > 0 && (
                      <span className="text-xs text-gray-400">
                        💬 {d._count.comments}
                      </span>
                    )}
                    {d._count?.attachments > 0 && (
                      <span className="text-xs text-gray-400">
                        📎 {d._count.attachments}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={cn(
                    'text-xs font-medium',
                    d.isOverdue ? 'text-red-600' : 'text-gray-500'
                  )}>
                    {formatDate(d.dueDate)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {d.responsible?.name}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg
                         disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg
                         disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
