'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, RotateCcw, Loader2 } from 'lucide-react'

export function InativarAtivoBtn({ ativoId, status }: { ativoId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const inativo = status === 'inativo'

  async function toggle() {
    const novo = inativo ? 'disponivel' : 'inativo'
    if (!inativo && !confirm('Inativar este item? Ele sai da operação (não fica disponível para alocação).')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/frota/ativos/${ativoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novo }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || d?.success === false) { alert(d?.error ?? 'Não foi possível alterar o status.'); return }
      router.refresh()
    } catch { alert('Falha de conexão.') } finally { setLoading(false) }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors disabled:opacity-60 ${
        inativo ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : inativo ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
      {inativo ? 'Reativar' : 'Inativar'}
    </button>
  )
}
