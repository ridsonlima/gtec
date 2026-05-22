'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Unlink } from 'lucide-react'

export function DesalocarAtivoBtn({ ativoId, ativoTag }: { ativoId: string; ativoTag: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function desalocar() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/frota/ativos/${ativoId}/alocacao`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao desalocar')
      setConfirm(false); router.refresh()
    } finally { setSaving(false) }
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-amber-700 text-sm font-medium rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors">
        <Unlink className="w-4 h-4" /> Desalocar
      </button>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-sm text-amber-800 font-medium">Confirmar desalocação de {ativoTag}?</p>
      <p className="text-xs text-amber-600">O ativo voltará ao status Disponível.</p>
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg">Cancelar</button>
        <button onClick={desalocar} disabled={saving} className="px-3 py-1.5 text-xs text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
          {saving ? 'Desalocando…' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}
