'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Filter } from 'lucide-react'

const TYPE_OPTIONS = [
  { value: '',                label: 'Todos os tipos' },
  { value: 'follow_up',      label: 'Cobranças' },
  { value: 'evidence_request', label: 'Pedidos de Evidência' },
  { value: 'clarification',  label: 'Solicitações' },
  { value: 'observation',    label: 'Observações' },
]

interface Props {
  currentType: string
  currentSearch: string
  currentTab: string
}

export function InteracoesFilters({ currentType, currentSearch, currentTab }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function navigate(type: string, search: string) {
    const p = new URLSearchParams()
    if (currentTab && currentTab !== 'all') p.set('tab', currentTab)
    if (type) p.set('type', type)
    if (search) p.set('search', search)
    const s = p.toString()
    startTransition(() => {
      router.push(`/interacoes${s ? '?' + s : ''}`)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Filter className="w-4 h-4" />
        <span className="font-medium">Filtros</span>
      </div>

      <input
        type="text"
        placeholder="Buscar conteúdo..."
        defaultValue={currentSearch}
        onChange={(e) => navigate(currentType, e.target.value)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <select
        value={currentType}
        onChange={(e) => navigate(e.target.value, currentSearch)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {(currentType || currentSearch) && (
        <button
          onClick={() => navigate('', '')}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
