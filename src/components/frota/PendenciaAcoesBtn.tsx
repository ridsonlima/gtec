'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock } from 'lucide-react'

type Status = 'aberta' | 'em_tratativa' | 'resolvida' | 'reincidente'

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export function PendenciaAcoesBtn({ pendenciaId, status }: { pendenciaId: string; status: Status }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResolver, setShowResolver] = useState(false)
  const [resolucaoNota, setResolucaoNota] = useState('')

  async function update(body: object) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/frota/auditorias/pendencias/${pendenciaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      router.refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Ações</h2>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {status === 'aberta' && (
        <button
          onClick={() => update({ status: 'em_tratativa' })}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
        >
          <Clock className="w-4 h-4" />
          {loading ? 'Atualizando…' : 'Mover para Em tratativa'}
        </button>
      )}

      {!showResolver ? (
        <button
          onClick={() => setShowResolver(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4" />
          Registrar resolução
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nota de resolução</label>
            <textarea
              value={resolucaoNota}
              onChange={(e) => setResolucaoNota(e.target.value)}
              rows={3}
              placeholder="Descreva como a pendência foi resolvida…"
              className={`${INPUT} resize-none`}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowResolver(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg">Cancelar</button>
            <button
              onClick={() => update({ status: 'resolvida', resolucaoNota: resolucaoNota.trim() || undefined })}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Salvando…' : 'Confirmar resolução'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
