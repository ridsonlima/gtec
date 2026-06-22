'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'

interface Opt { id: string; label: string }

export function AreaFiltro({ usuarios, contratos }: { usuarios: Opt[]; contratos: Opt[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const resp = sp.get('resp') ?? ''
  const contrato = sp.get('contrato') ?? ''
  const hasFilter = !!resp || !!contrato

  function update(key: string, val: string) {
    const p = new URLSearchParams(sp.toString())
    if (val) p.set(key, val); else p.delete(key)
    router.push(`${pathname}?${p.toString()}`)
  }

  function clear() {
    const p = new URLSearchParams(sp.toString())
    p.delete('resp'); p.delete('contrato')
    router.push(p.toString() ? `${pathname}?${p.toString()}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3">
      <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-400">Filtrar por</span>

      <select
        value={resp}
        onChange={(e) => update('resp', e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[170px]"
      >
        <option value="">Todos os responsáveis</option>
        {usuarios.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>

      <select
        value={contrato}
        onChange={(e) => update('contrato', e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px] max-w-[260px]"
      >
        <option value="">Todos os contratos</option>
        {contratos.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      {hasFilter && (
        <button onClick={clear} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X className="w-3 h-3" /> Limpar
        </button>
      )}
    </div>
  )
}
