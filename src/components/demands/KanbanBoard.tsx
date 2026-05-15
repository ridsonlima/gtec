'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { formatDate } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

const COLUMNS = [
  { key: 'pending',     label: 'Pendente',     headerCls: 'bg-gray-100 text-gray-600' },
  { key: 'in_progress', label: 'Em Andamento', headerCls: 'bg-blue-100 text-blue-700' },
  { key: 'blocked',     label: 'Bloqueada',    headerCls: 'bg-red-100 text-red-700' },
  { key: 'completed',   label: 'Concluída',    headerCls: 'bg-green-100 text-green-700' },
] as const

type Status = typeof COLUMNS[number]['key'] | 'cancelled'

type Demand = {
  id: string
  title: string
  status: string
  priority: string
  isOverdue: boolean
  dueDate: string | Date | null
  area: { name: string }
  responsible: { name: string }
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function KanbanBoard({ initialDemands }: { initialDemands: Demand[] }) {
  const [demands, setDemands] = useState(initialDemands)
  const [moving, setMoving]   = useState<string | null>(null)

  async function moveTo(demandId: string, newStatus: Status) {
    setMoving(demandId)
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setDemands((prev) =>
          newStatus === 'cancelled'
            ? prev.filter((d) => d.id !== demandId)
            : prev.map((d) => (d.id === demandId ? { ...d, status: newStatus } : d))
        )
      }
    } finally {
      setMoving(null)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: '70vh' }}>
      {COLUMNS.map((col) => {
        const colDemands = demands
          .filter((d) => d.status === col.key)
          .sort((a, b) => {
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
            return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
          })

        return (
          <div key={col.key} className="flex-shrink-0 w-72">
            <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${col.headerCls}`}>
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="text-xs font-bold opacity-70">{colDemands.length}</span>
            </div>

            <div className="space-y-2">
              {colDemands.map((demand) => (
                <KanbanCard
                  key={demand.id}
                  demand={demand}
                  currentStatus={col.key}
                  isMoving={moving === demand.id}
                  onMove={moveTo}
                />
              ))}
              {colDemands.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-xs text-gray-400">
                  Nenhuma demanda
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({
  demand,
  currentStatus,
  isMoving,
  onMove,
}: {
  demand: Demand
  currentStatus: string
  isMoving: boolean
  onMove: (id: string, s: Status) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const otherCols = COLUMNS.filter((c) => c.key !== currentStatus)

  const dueDateDisplay = demand.dueDate
    ? formatDate(typeof demand.dueDate === 'string' ? new Date(demand.dueDate) : demand.dueDate)
    : null

  return (
    <div
      className={`bg-white rounded-xl border p-3 shadow-sm transition-opacity ${
        isMoving ? 'opacity-50' : ''
      } ${demand.isOverdue ? 'border-l-4 border-l-red-500 border-r border-t border-b border-gray-200' : 'border-gray-200'}`}
    >
      <Link href={`/demandas/${demand.id}`}>
        <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2 hover:text-blue-600 leading-snug">
          {demand.title}
        </p>
      </Link>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <PriorityBadge priority={demand.priority} />
        {demand.isOverdue && (
          <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
            VENCIDA
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{demand.responsible.name}</p>
          <p className="text-xs text-gray-400 truncate">{demand.area.name}</p>
          {dueDateDisplay && (
            <p className={`text-xs mt-0.5 ${demand.isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {dueDateDisplay}
            </p>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isMoving}
            className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-700
                       px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            Mover <ChevronDown className="w-3 h-3" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200
                              rounded-xl shadow-lg z-20 py-1 min-w-36 overflow-hidden">
                {otherCols.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => { onMove(demand.id, c.key); setMenuOpen(false) }}
                    className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 text-gray-700"
                  >
                    → {c.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={() => { onMove(demand.id, 'cancelled'); setMenuOpen(false) }}
                    className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-500"
                  >
                    × Cancelar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
