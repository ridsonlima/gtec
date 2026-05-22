'use client'

import { useState } from 'react'
import { timeAgo } from '@/lib/utils'
import { MessageSquarePlus } from 'lucide-react'

type Update = { id: string; content: string; createdAt: Date; author: { name: string } }

interface Props {
  demandId: string
  initialUpdates: Update[]
  canAdd: boolean
}

export function DemandEvolutions({ demandId, initialUpdates, canAdd }: Props) {
  const [updates, setUpdates] = useState(initialUpdates)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!content.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/demands/${demandId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao registrar'); return }
      setUpdates((prev) => [{ id: data.data.id, content: data.data.content, createdAt: new Date(), author: { name: 'Você' } }, ...prev])
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
        <MessageSquarePlus className="w-3.5 h-3.5" />
        Evoluções ({updates.length})
      </h3>

      {canAdd && (
        <div className="mb-5 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Registre um progresso, decisão, bloqueio ou próximo passo…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving || !content.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enviando…' : 'Registrar evolução'}
            </button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhuma evolução registrada.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-4">
            {updates.map((u) => (
              <div key={u.id} className="relative pl-8">
                <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white bg-blue-400 ring-1 ring-blue-200" />
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-700">{u.author.name}</span>
                  <span className="text-xs text-gray-400">{timeAgo(u.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{u.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
