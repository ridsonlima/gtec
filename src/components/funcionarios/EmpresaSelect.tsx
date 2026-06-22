'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X } from 'lucide-react'

interface Empresa { id: string; nome: string }

/** Dropdown de empresas (cadastro gerenciável) com opção de criar nova na hora. */
export function EmpresaSelect({ value, onChange, className }: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['empresas'], queryFn: () => fetch('/api/empresas').then((r) => r.json()) })
  const empresas: Empresa[] = data?.data ?? []
  const [adding, setAdding] = useState(false)
  const [novo, setNovo] = useState('')

  const createM = useMutation({
    mutationFn: async (nome: string) => {
      const res = await fetch('/api/empresas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erro')
      return j.data as Empresa
    },
    onSuccess: (emp) => { qc.invalidateQueries({ queryKey: ['empresas'] }); onChange(emp.nome); setAdding(false); setNovo('') },
  })

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Nome da nova empresa"
          className={className}
          onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) createM.mutate(novo.trim()) }}
        />
        <button type="button" onClick={() => createM.mutate(novo.trim())} disabled={!novo.trim() || createM.isPending} className="px-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
          {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => { setAdding(false); setNovo('') }} className="px-2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
    )
  }

  // Garante que o valor atual apareça mesmo se ainda não estiver na lista carregada
  const semNaLista = value && !empresas.some((e) => e.nome === value)

  return (
    <select
      value={value}
      onChange={(e) => { if (e.target.value === '__new__') setAdding(true); else onChange(e.target.value) }}
      className={className}
    >
      <option value="">Sem empresa</option>
      {semNaLista && <option value={value}>{value}</option>}
      {empresas.map((e) => <option key={e.id} value={e.nome}>{e.nome}</option>)}
      <option value="__new__">➕ Nova empresa…</option>
    </select>
  )
}
