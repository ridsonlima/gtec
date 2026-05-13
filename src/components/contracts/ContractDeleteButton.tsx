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
    const res = await fetch(`/api/contracts/${contractId}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data?.error) {
      alert(data?.error ?? 'Não foi possível excluir o contrato.')
      return
    }
    router.push('/contratos')
    router.refresh()
  }

  return (
    <button onClick={remove} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-60">
      <Trash2 className="w-4 h-4" />
      {loading ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
