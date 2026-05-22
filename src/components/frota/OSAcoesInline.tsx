'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle, XCircle } from 'lucide-react'

type Status = 'aberta' | 'em_execucao' | 'concluida' | 'cancelada'

interface Props {
  osId: string
  status: Status
  role: string
}

export function OSAcoesInline({ osId, status, role }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canAdmin = ['master', 'admin'].includes(role)

  async function action(endpoint: string) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/frota/ordens-servico/${osId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      router.refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-red-600 text-right max-w-32">{error}</p>}

      {status === 'aberta' && (
        <button
          onClick={() => action('iniciar')}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          <Play className="w-3 h-3" /> {loading ? '…' : 'Iniciar'}
        </button>
      )}

      {status === 'em_execucao' && (
        <button
          onClick={() => action('concluir')}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
        >
          <CheckCircle className="w-3 h-3" /> {loading ? '…' : 'Concluir'}
        </button>
      )}

      {canAdmin && (
        <button
          onClick={() => action('cancelar')}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="w-3 h-3" /> {loading ? '…' : 'Cancelar'}
        </button>
      )}
    </div>
  )
}
