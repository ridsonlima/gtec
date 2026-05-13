'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Edit2, Trash2, X, Check } from 'lucide-react'

export function DemandUpdateActions({ updateId, initialContent }: { updateId: string; initialContent: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    await fetch(`/api/demands/updates/${updateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setLoading(false)
    setEditing(false)
    router.refresh()
  }

  async function remove() {
    if (!confirm('Excluir esta resposta?')) return
    setLoading(true)
    await fetch(`/api/demands/updates/${updateId}`, { method: 'DELETE' })
    setLoading(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <textarea className="input min-h-24" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={save} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-cdg-blue text-white rounded"><Check className="w-3 h-3" />Salvar</button>
          <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded"><X className="w-3 h-3" />Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 flex gap-2">
      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-cdg-blue"><Edit2 className="w-3 h-3" />Editar</button>
      <button onClick={remove} disabled={loading} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"><Trash2 className="w-3 h-3" />Excluir</button>
    </div>
  )
}
