'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, closestCorners, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { DemandSignalBadges } from '@/components/demands/DemandSignalBadges'
import { formatDate } from '@/lib/utils'
import { ChevronDown, X, SlidersHorizontal, ArrowRightLeft, GripVertical } from 'lucide-react'

const COLUMNS = [
  { key: 'pending',          label: 'Pendente',      headerCls: 'bg-gray-100 text-gray-600' },
  { key: 'in_progress',      label: 'Em Andamento',  headerCls: 'bg-blue-100 text-blue-700' },
  { key: 'pending_approval', label: 'Em Aprovação',  headerCls: 'bg-amber-100 text-amber-700' },
  { key: 'blocked',          label: 'Bloqueada',     headerCls: 'bg-red-100 text-red-700' },
  { key: 'completed',        label: 'Concluída',     headerCls: 'bg-green-100 text-green-700' },
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
  substituicaoInfo?: { substitutoNome: string } | null
  unread?: boolean
  isStale?: boolean
  staleDays?: number
  overdueLevel?: 'none' | 'late' | 'very_late'
  overdueDays?: number
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function KanbanBoard({ initialDemands }: { initialDemands: Demand[] }) {
  const [demands, setDemands] = useState(initialDemands)
  const [moving, setMoving]   = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const draggedRef = useRef(false)

  const [filterArea,     setFilterArea]     = useState('')
  const [filterPerson,   setFilterPerson]   = useState('')
  const [filterDeadline, setFilterDeadline] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const areaOptions = useMemo(
    () => Array.from(new Set(demands.map((d) => d.area.name))).sort(),
    [demands],
  )
  const personOptions = useMemo(
    () => Array.from(new Set(demands.map((d) => d.responsible.name))).sort(),
    [demands],
  )

  const filteredDemands = useMemo(() => {
    return demands.filter((d) => {
      if (filterArea   && d.area.name        !== filterArea)   return false
      if (filterPerson && d.responsible.name !== filterPerson) return false
      if (filterDeadline) {
        if (!d.dueDate) return false
        const due   = new Date(d.dueDate)
        const limit = new Date(filterDeadline)
        limit.setHours(23, 59, 59, 999)
        if (due > limit) return false
      }
      return true
    })
  }, [demands, filterArea, filterPerson, filterDeadline])

  const hasFilter = filterArea || filterPerson || filterDeadline
  const clearFilters = () => { setFilterArea(''); setFilterPerson(''); setFilterDeadline('') }

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

  function onDragStart(e: DragStartEvent) {
    draggedRef.current = true
    setActiveId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const id = String(e.active.id)
    const overCol = e.over ? String(e.over.id) : null
    if (overCol) {
      const d = demands.find((x) => x.id === id)
      if (d && d.status !== overCol) moveTo(id, overCol as Status)
    }
    // libera o clique logo após (evita abrir a demanda após arrastar)
    setTimeout(() => { draggedRef.current = false }, 60)
  }

  function onDragCancel() {
    setActiveId(null)
    setTimeout(() => { draggedRef.current = false }, 60)
  }

  const activeDemand = activeId ? demands.find((d) => d.id === activeId) ?? null : null

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />

        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
        >
          <option value="">Todas as áreas</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filterPerson}
          onChange={(e) => setFilterPerson(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
        >
          <option value="">Todas as pessoas</option>
          {personOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 whitespace-nowrap">Prazo até</span>
          <input
            type="date"
            value={filterDeadline}
            onChange={(e) => setFilterDeadline(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-auto"
          >
            <X className="w-3 h-3" />
            Limpar filtros
          </button>
        )}

        {hasFilter && (
          <span className="text-xs text-gray-400 ml-1">
            {filteredDemands.length} de {demands.length} demanda{demands.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: '70vh' }}>
          {COLUMNS.map((col) => {
            const colDemands = filteredDemands
              .filter((d) => d.status === col.key)
              .sort((a, b) => {
                if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
                return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
              })

            return (
              <DroppableColumn key={col.key} colKey={col.key} headerCls={col.headerCls} label={col.label} count={colDemands.length} active={activeId !== null}>
                {colDemands.map((demand) => (
                  <KanbanCard
                    key={demand.id}
                    demand={demand}
                    currentStatus={col.key}
                    isMoving={moving === demand.id}
                    onMove={moveTo}
                    wasDragging={() => draggedRef.current}
                  />
                ))}
              </DroppableColumn>
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDemand ? <CardGhost demand={activeDemand} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function DroppableColumn({ colKey, headerCls, label, count, active, children }: {
  colKey: string; headerCls: string; label: string; count: number; active: boolean; children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey })
  return (
    <div className="flex-shrink-0 w-72">
      <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${headerCls}`}>
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs font-bold opacity-70">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 rounded-xl transition-colors min-h-[120px] ${isOver ? 'ring-2 ring-blue-400 bg-blue-50/50 p-1' : ''}`}
      >
        {children}
        {count === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-xs text-gray-400">
            {isOver ? 'Solte aqui' : active ? 'Arraste para cá' : 'Nenhuma demanda'}
          </div>
        )}
      </div>
    </div>
  )
}

/** Cartão "fantasma" que segue o dedo/cursor durante o arraste. */
function CardGhost({ demand }: { demand: Demand }) {
  return (
    <div className={`rounded-xl border p-3 shadow-xl rotate-2 w-72 ${demand.isOverdue ? 'border-l-4 border-l-red-500 border-gray-200' : 'border-gray-200'} bg-white`}>
      <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2 leading-snug">{demand.title}</p>
      <div className="flex items-center gap-1.5 mb-1">
        <PriorityBadge priority={demand.priority} />
      </div>
      <p className="text-xs text-gray-500 truncate">{demand.responsible.name}</p>
    </div>
  )
}

function KanbanCard({
  demand,
  currentStatus,
  isMoving,
  onMove,
  wasDragging,
}: {
  demand: Demand
  currentStatus: string
  isMoving: boolean
  onMove: (id: string, s: Status) => void
  wasDragging?: () => boolean
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const otherCols = COLUMNS.filter((c) => c.key !== currentStatus)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: demand.id })

  const [seen, setSeen] = useState(!demand.unread)
  const dueDateDisplay = demand.dueDate
    ? formatDate(typeof demand.dueDate === 'string' ? new Date(demand.dueDate) : demand.dueDate)
    : null

  const unread = demand.unread && !seen

  function markViewed() {
    setSeen(true)
    fetch(`/api/demands/${demand.id}/view`, { method: 'POST' }).catch(() => {})
  }

  function openDemand() {
    if (wasDragging?.()) return  // acabou de arrastar → não abre
    markViewed()
    router.push(`/demandas/${demand.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={openDemand}
      style={{ touchAction: 'manipulation' }}
      className={`group rounded-xl border p-3 shadow-sm transition-all cursor-grab active:cursor-grabbing ${
        isMoving ? 'opacity-50' : ''
      } ${isDragging ? 'opacity-30' : ''} ${
        unread ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      } ${demand.isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="flex-1 text-sm font-medium text-gray-800 line-clamp-2 mb-2 hover:text-blue-600 leading-snug">
          {demand.title}
        </p>
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <PriorityBadge priority={demand.priority} />
        <DemandSignalBadges d={{ ...demand, unread }} />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{demand.responsible.name}</p>
          {demand.substituicaoInfo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full my-0.5" title={`Substituído por ${demand.substituicaoInfo.substitutoNome}`}>
              <ArrowRightLeft className="w-2.5 h-2.5" /> {demand.substituicaoInfo.substitutoNome}
            </span>
          )}
          <p className="text-xs text-gray-400 truncate">{demand.area.name}</p>
          {dueDateDisplay && (
            <p className={`text-xs mt-0.5 ${demand.isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {dueDateDisplay}
            </p>
          )}
        </div>

        <div
          className="relative flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
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
                    onClick={() => { markViewed(); onMove(demand.id, c.key); setMenuOpen(false) }}
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
