'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, X, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react'

interface Empresa { id: string; nome: string; tipo: string | null }

export function GerenciarEmpresas({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['empresas'], queryFn: () => fetch('/api/empresas').then((r) => r.json()) })
  const empresas: Empresa[] = data?.data ?? []

  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [erro, setErro] = useState('')

  const refresh = () => { qc.invalidateQueries({ queryKey: ['empresas'] }); qc.invalidateQueries({ queryKey: ['funcionarios'] }) }

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/empresas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() }) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setNovo(''); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const renameM = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/empresas/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: editNome.trim() }) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setEditId(null); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const delM = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: refresh,
    onError: (e: any) => setErro(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-5 h-5" /> Empresas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        {/* Adicionar */}
        <div className="flex gap-2">
          <input value={novo} onChange={(e) => { setNovo(e.target.value); setErro('') }} placeholder="Nova empresa (própria ou terceirizada)"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) createM.mutate() }} />
          <button onClick={() => createM.mutate()} disabled={!novo.trim() || createM.isPending} className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : empresas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma empresa cadastrada.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {empresas.map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-2">
                {editId === e.id ? (
                  <>
                    <input autoFocus value={editNome} onChange={(ev) => setEditNome(ev.target.value)} className="flex-1 text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      onKeyDown={(ev) => { if (ev.key === 'Enter' && editNome.trim()) renameM.mutate() }} />
                    <button onClick={() => renameM.mutate()} disabled={renameM.isPending} className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {renameM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-800">{e.nome}</span>
                    <button onClick={() => { setEditId(e.id); setEditNome(e.nome); setErro('') }} title="Renomear" className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setErro(''); delM.mutate(e.id) }} title="Remover" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">Renomear uma empresa atualiza automaticamente todos os funcionários vinculados a ela.</p>
      </div>
    </div>
  )
}
