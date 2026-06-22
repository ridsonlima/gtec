'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

export function GerarPautaSemanalBtn() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function gerar() {
    if (!confirm('Gerar uma pauta semanal automática com as pendências, reports e comunicados da semana?')) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/agenda/gerar-semanal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data?.success === false) {
        setError(data?.error ?? 'Erro ao gerar pauta')
        setLoading(false)
        return
      }
      router.push(`/pauta/${data.data.id}`)
    } catch {
      setError('Erro ao gerar pauta')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={gerar}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Gerando…' : 'Gerar pauta semanal'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
