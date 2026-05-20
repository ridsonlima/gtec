'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Settings2, GripVertical, X, Eye, EyeOff, RotateCcw } from 'lucide-react'
import {
  WIDGET_CATALOG, WidgetId, loadDashPrefs, saveDashPrefs,
} from '@/lib/dashboard-prefs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardData {
  // alerts
  overdueDemands: number
  pendingEvidence: number
  inactiveAreas: number
  contractsAtRiskCount: number
  interareaSlaAlertsCount: number
  // contracts expiring
  contractsExpiringSoon: number
  contractsExpiringHref: string
  // sla interarea
  interareaSlaAlerts: {
    id: string; title: string; areaName: string; requestingAreaName: string | null
    slaStatus: string | null; slaDeadline: string | null
  }[]
  // area status
  areaStatus: {
    id: string; name: string
    daysSinceLastReport: number | null; activeDemands: number
    overdueCount: number; completionRate: number | null
    contractsActive: number; status: string
  }[]
  // critical demands
  criticalDemands: {
    id: string; title: string; priority: string; status: string
    isOverdue: boolean; dueDate: string; areaName: string; responsibleName: string | null
  }[]
  // activity feed
  feedItems: {
    id: string; demandId: string; demandTitle: string; areaName: string
    authorName: string; content: string; statusAfter: string | null
    createdAt: string; seen: boolean
  }[]
  feedUnseenCount: number
  // contracts risk
  contractsAtRisk: { id: string; name: string; number: string; areaName: string; status: string }[]
  // awaiting decision
  decisionsNeeded: { id: string; areaName: string; decisionsNeeded: string | null; publishedAt: string | null }[]
  // recent comments
  recentComments: {
    id: string; objectType: string; objectId: string; authorName: string
    content: string; createdAt: string
  }[]
}

// ─── Sortable item wrapper ─────────────────────────────────────────────────────

function SortableWidget({ id, editing, children }: {
  id: string; editing: boolean; children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {editing && (
        <div
          {...attributes} {...listeners}
          className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center
                     cursor-grab active:cursor-grabbing z-10 text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div className={editing ? 'pl-8 ring-2 ring-blue-200 rounded-xl' : ''}>{children}</div>
    </div>
  )
}

// ─── Right panel ──────────────────────────────────────────────────────────────

function WidgetPanel({
  open, onClose, order, visible,
  onToggle, onReset,
}: {
  open: boolean; onClose: () => void
  order: WidgetId[]; visible: Set<WidgetId>
  onToggle: (id: WidgetId) => void; onReset: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      )}

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col
                       transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">Personalizar Dashboard</p>
            <p className="text-xs text-gray-400 mt-0.5">Ligue ou desligue os cards abaixo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Widget list */}
        <div className="flex-1 overflow-y-auto py-3 px-4 space-y-1">
          {order.map((id) => {
            const meta = WIDGET_CATALOG.find((w) => w.id === id)
            if (!meta) return null
            const on = visible.has(id)
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors
                            ${on ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
              >
                <div className={`mt-0.5 flex-shrink-0 w-8 h-5 rounded-full relative transition-colors
                                 ${on ? 'bg-blue-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                                    ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${on ? 'text-blue-700' : 'text-gray-600'}`}>{meta.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{meta.description}</p>
                </div>
                {on
                  ? <Eye className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-1" />
                  : <EyeOff className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
                }
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100">
          <button
            onClick={onReset}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrão
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function DashboardGrid({
  data,
  widgets,
}: {
  data: DashboardData
  widgets: Record<WidgetId, React.ReactNode>
}) {
  const [order, setOrder]   = useState<WidgetId[]>([])
  const [visible, setVisible] = useState<Set<WidgetId>>(new Set())
  const [panelOpen, setPanelOpen]   = useState(false)
  const [editing, setEditing] = useState(false)
  const [activeId, setActiveId] = useState<WidgetId | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const prefs = loadDashPrefs()
    setOrder(prefs.order)
    setVisible(prefs.visible)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) saveDashPrefs(order, visible)
  }, [order, visible, mounted])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as WidgetId)

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const from = prev.indexOf(active.id as WidgetId)
      const to   = prev.indexOf(over.id as WidgetId)
      return arrayMove(prev, from, to)
    })
  }, [])

  const toggleWidget = useCallback((id: WidgetId) => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const resetPrefs = useCallback(() => {
    localStorage.removeItem('dash:widget-order')
    localStorage.removeItem('dash:widget-visible')
    const prefs = loadDashPrefs()
    setOrder(prefs.order)
    setVisible(prefs.visible)
  }, [])

  if (!mounted) {
    // SSR placeholder — matches the server render
    return <div className="space-y-6 animate-pulse">{Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-32 bg-gray-100 rounded-xl" />
    ))}</div>
  }

  const visibleOrder = order.filter((id) => visible.has(id))

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{visibleOrder.length} de {order.length} cards ativos</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                        ${editing ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <GripVertical className="w-3.5 h-3.5" />
            {editing ? 'Concluir' : 'Reordenar'}
          </button>
          <button
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Personalizar
          </button>
        </div>
      </div>

      {/* Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {visibleOrder.map((id) => (
              <SortableWidget key={id} id={id} editing={editing}>
                {widgets[id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId && (
            <div className="opacity-90 shadow-xl rounded-xl ring-2 ring-blue-400 pointer-events-none">
              {widgets[activeId]}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {visibleOrder.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Settings2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhum card ativo</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Personalizar" para adicionar cards ao dashboard</p>
          <button onClick={() => setPanelOpen(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Personalizar
          </button>
        </div>
      )}

      <WidgetPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        order={order}
        visible={visible}
        onToggle={toggleWidget}
        onReset={resetPrefs}
      />
    </>
  )
}
