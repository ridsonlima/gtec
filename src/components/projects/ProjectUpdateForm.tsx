'use client'

import { useState } from 'react'
import { timeAgo } from '@/lib/utils'

type Update = { id: string; content: string; createdAt: Date; authorName: string }

interface Props {
  projectId: string
  initialUpdates: Update[]
  canAdd: boolean
}

export function ProjectUpdateForm({ projectId, initialUpdates, canAdd }: Props) {
  const [updates, setUpdates] = useState(initialUpdates)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setUpdates((prev) => [{ id: data.data.id, content: data.data.content, createdAt: new Date(), authorName: 'Você' }, ...prev])
        setContent('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Atualizações
      </h3>

      {canAdd && (
        <div className="mb-4 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Registre uma atualização, decisão ou bloqueio…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving || !content.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Enviando…' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma atualização registrada.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-4">
            {updates.map((u) => (
              <div key={u.id} className="relative pl-8">
                <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white bg-blue-300 ring-1 ring-blue-100" />
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-gray-700">{u.authorName}</span>
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
