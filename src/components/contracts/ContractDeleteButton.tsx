'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function ContractDeleteButton({ contractId }: { contractId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    if (!confirm('Excluir este contrato? Esta ação não pode ser desfeita.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error || data?.success === false) {
        alert(data?.error ?? `Não foi possível excluir o contrato (erro ${res.status}).`)
        return
      }
      router.push('/contratos')
      router.refresh()
    } catch (e) {
      alert('Falha de conexão ao excluir o contrato. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={remove} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-60">
      <Trash2 className="w-4 h-4" />
      {loading ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
