'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  evidenceId: string
  currentStatus: string
  isRequester: boolean
}

export function EvidenciaActions({ evidenceId, currentStatus, isRequester }: Props) {
  const [status, setStatus]       = useState(currentStatus)
  const [notes, setNotes]         = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [action, setAction]       = useState<'received' | 'rejected' | null>(null)
  const [loading, setLoading]     = useState(false)

  if (!isRequester || status !== 'pending') return null

  async function resolve(s: 'received' | 'rejected') {
    setLoading(true)
    try {
      const res = await fetch(`/api/evidencias/${evidenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: s, responseNotes: notes.trim() || null }),
      })
      if (res.ok) {
        setStatus(s)
        setShowForm(false)
      }
    } finally {
      setLoading(false)
    }
  }

  if (status !== 'pending') {
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        status === 'received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}>
        {status === 'received' ? 'Recebida ✓' : 'Rejeitada'}
      </span>
    )
  }

  if (showForm) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={action === 'received' ? 'Observações (opcional)…' : 'Motivo da rejeição…'}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => resolve(action!)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white disabled:opacity-50 ${
              action === 'received' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Salvando…' : action === 'received' ? 'Confirmar recebimento' : 'Confirmar rejeição'}
          </button>
          <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => { setAction('received'); setShowForm(true) }}
        className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Marcar como Recebida
      </button>
      <button
        onClick={() => { setAction('rejected'); setShowForm(true) }}
        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors"
      >
        <XCircle className="w-3.5 h-3.5" />
        Rejeitar
      </button>
    </div>
  )
}
