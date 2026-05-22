'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Trash2, Plus, ListChecks, Calendar, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type ChecklistItem = {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  isCompleted: boolean
  completedAt: Date | null
  createdBy: { name: string }
}

interface Props {
  demandId: string
  initialItems: ChecklistItem[]
  canManage: boolean
}

function isOverdue(dueDate: Date | null, isCompleted: boolean) {
  if (!dueDate || isCompleted) return false
  return new Date() > new Date(dueDate)
}

export function DemandChecklist({ demandId, initialItems, canManage }: Props) {
  const [items, setItems] = useState(initialItems)
  const [loading, setLoading] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function toggle(item: ChecklistItem) {
    setLoading(item.id)
    try {
      const res = await fetch(`/api/demands/${demandId}/checklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !item.isCompleted }),
      })
      if (res.ok) {
        setItems((prev) => prev.map((x) =>
          x.id === item.id
            ? { ...x, isCompleted: !x.isCompleted, completedAt: !x.isCompleted ? new Date() : null }
            : x
        ))
      }
    } finally {
      setLoading(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover esta atividade?')) return
    setLoading(id)
    try {
      const res = await fetch(`/api/demands/${demandId}/checklist/${id}`, { method: 'DELETE' })
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setLoading(null)
    }
  }

  async function addItem() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          dueDate: newDueDate || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems((prev) => [...prev, {
          ...data.data,
          dueDate: data.data.dueDate ? new Date(data.data.dueDate) : null,
          completedAt: null,
        }])
        setNewTitle('')
        setNewDescription('')
        setNewDueDate('')
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const completed = items.filter((i) => i.isCompleted).length
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0
  const overdueCount = items.filter((i) => isOverdue(i.dueDate, i.isCompleted)).length

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" />
          Atividades ({completed}/{items.length} concluídas)
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
            </span>
          )}
        </h3>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Progresso</span>
            <span className="font-medium text-gray-600">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400 italic">Nenhuma atividade definida.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const overdue = isOverdue(item.dueDate, item.isCompleted)
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 ${item.isCompleted ? 'opacity-60' : ''}`}
              >
                <button
                  onClick={() => canManage && toggle(item)}
                  disabled={loading === item.id || !canManage}
                  className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors disabled:cursor-default"
                >
                  {item.isCompleted
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Circle className="w-4 h-4" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{item.createdBy?.name}</span>
                    {item.dueDate && !item.isCompleted && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-amber-600'}`}>
                        <Calendar className="w-3 h-3" />
                        {overdue ? 'Venceu ' : 'Prazo: '}
                        {formatDate(item.dueDate)}
                      </span>
                    )}
                    {item.completedAt && (
                      <span className="text-xs text-gray-400">· Concluído em {formatDate(item.completedAt)}</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => remove(item.id)}
                    disabled={loading === item.id}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome da atividade *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <label className="text-xs text-gray-400 whitespace-nowrap">Prazo</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setNewTitle(''); setNewDescription(''); setNewDueDate('') }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={addItem}
              disabled={saving || !newTitle.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
