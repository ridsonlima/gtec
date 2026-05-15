'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Trash2, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Milestone = {
  id: string
  title: string
  description: string | null
  dueDate: Date
  isCompleted: boolean
  completedAt: Date | null
}

interface Props {
  projectId: string
  milestones: Milestone[]
  canManage: boolean
}

export function MilestoneList({ projectId, milestones: initial, canManage }: Props) {
  const [milestones, setMilestones] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [saving, setSaving] = useState(false)

  async function toggle(m: Milestone) {
    setLoading(m.id)
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !m.isCompleted }),
      })
      if (res.ok) {
        setMilestones((prev) =>
          prev.map((x) => x.id === m.id
            ? { ...x, isCompleted: !x.isCompleted, completedAt: !x.isCompleted ? new Date() : null }
            : x
          )
        )
      }
    } finally {
      setLoading(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover este marco?')) return
    setLoading(id)
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${id}`, { method: 'DELETE' })
      if (res.ok) setMilestones((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setLoading(null)
    }
  }

  async function addMilestone() {
    if (!newTitle.trim() || !newDue) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), dueDate: newDue }),
      })
      if (res.ok) {
        const data = await res.json()
        setMilestones((prev) => [...prev, { ...data.data, dueDate: new Date(data.data.dueDate) }])
        setNewTitle('')
        setNewDue('')
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const completed = milestones.filter((m) => m.isCompleted).length

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Marcos ({completed}/{milestones.length} concluídos)
        </h3>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        )}
      </div>

      {/* Barra de progresso */}
      {milestones.length > 0 && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0}%` }}
          />
        </div>
      )}

      {milestones.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400">Nenhum marco definido.</p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div key={m.id} className={`flex items-start gap-3 py-2 border-b border-gray-50 last:border-0 ${m.isCompleted ? 'opacity-60' : ''}`}>
              <button
                onClick={() => canManage && toggle(m)}
                disabled={loading === m.id || !canManage}
                className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-green-500 transition-colors disabled:cursor-default"
              >
                {m.isCompleted
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <Circle className="w-4 h-4" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${m.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {m.title}
                </p>
                {m.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                )}
                <p className={`text-xs mt-0.5 ${!m.isCompleted && new Date(m.dueDate) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  Prazo: {formatDate(m.dueDate)}
                  {m.completedAt && ` · Concluído em ${formatDate(m.completedAt)}`}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => remove(m.id)}
                  disabled={loading === m.id}
                  className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <input
            type="text"
            placeholder="Título do marco"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addMilestone}
              disabled={saving || !newTitle.trim() || !newDue}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
