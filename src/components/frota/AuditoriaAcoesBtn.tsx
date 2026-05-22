'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle, XCircle } from 'lucide-react'

type Status = 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'

interface Props {
  visitaId: string
  status: Status
  isAuditor: boolean
  canGestor: boolean
}

export function AuditoriaAcoesBtn({ visitaId, status, isAuditor, canGestor }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function action(endpoint: string, body?: object) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/frota/auditorias/${visitaId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      router.refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {status === 'agendada' && (isAuditor || canGestor) && (
        <button
          onClick={() => action('iniciar')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {loading ? 'Iniciando…' : 'Iniciar visita'}
        </button>
      )}

      {status === 'em_andamento' && (isAuditor || canGestor) && (
        <button
          onClick={() => action('concluir')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Concluindo…' : 'Concluir visita'}
        </button>
      )}

      {['agendada', 'em_andamento'].includes(status) && canGestor && (
        <button
          onClick={() => action('cancelar')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-700 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Cancelar visita
        </button>
      )}
    </div>
  )
}
