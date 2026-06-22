'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, X, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react'

interface Treino { id: string; nome: string; descricao: string | null; validadeMeses: number | null }

export function GerenciarTreinamentos({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['treinamentos'], queryFn: () => fetch('/api/treinamentos').then((r) => r.json()) })
  const treinos: Treino[] = data?.data ?? []

  const [novoNome, setNovoNome] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [novaValidade, setNovaValidade] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editValidade, setEditValidade] = useState('')
  const [erro, setErro] = useState('')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['treinamentos'] })
    qc.invalidateQueries({ queryKey: ['funcoes'] })
    qc.invalidateQueries({ queryKey: ['funcionario'] })
  }

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/treinamentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim(), descricao: novaDesc.trim() || null, validadeMeses: novaValidade ? Number(novaValidade) : null }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setNovoNome(''); setNovaDesc(''); setNovaValidade(''); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const patchM = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/treinamentos/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome.trim(), descricao: editDesc.trim() || null, validadeMeses: editValidade ? Number(editValidade) : null }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setEditId(null); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const delM = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/treinamentos/${id}`, { method: 'DELETE' })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: refresh,
    onError: (e: any) => setErro(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="w-5 h-5" /> Catálogo de treinamentos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-400 -mt-2">Inclua ou remova os tipos de treinamento. A validade (em meses) é opcional.</p>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        {/* Adicionar */}
        <div className="space-y-2 bg-gray-50 border border-gray-100 rounded-lg p-2">
          <div className="flex gap-2">
            <input value={novoNome} onChange={(e) => { setNovoNome(e.target.value); setErro('') }} placeholder="Novo treinamento (ex.: NR-12)"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              onKeyDown={(e) => { if (e.key === 'Enter' && novoNome.trim()) createM.mutate() }} />
            <input value={novaValidade} onChange={(e) => setNovaValidade(e.target.value)} type="number" placeholder="meses"
              className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button onClick={() => createM.mutate()} disabled={!novoNome.trim() || createM.isPending} className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          <input value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="Breve descrição do conteúdo (opcional)"
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : treinos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum treinamento cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
            {treinos.map((t) => (
              <div key={t.id} className="py-2">
                {editId === t.id ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input autoFocus value={editNome} onChange={(e) => setEditNome(e.target.value)} className="flex-1 text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={editValidade} onChange={(e) => setEditValidade(e.target.value)} type="number" placeholder="meses" className="w-16 text-sm border border-blue-200 rounded-lg px-2 py-1.5" />
                      <button onClick={() => patchM.mutate()} disabled={patchM.isPending} className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">{patchM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}</button>
                      <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descrição do conteúdo" className="w-full text-xs border border-blue-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{t.nome}</span>
                        {t.validadeMeses != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">validade {t.validadeMeses}m</span>}
                      </div>
                      {t.descricao && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{t.descricao}</p>}
                    </div>
                    <button onClick={() => { setEditId(t.id); setEditNome(t.nome); setEditDesc(t.descricao ?? ''); setEditValidade(t.validadeMeses != null ? String(t.validadeMeses) : ''); setErro('') }} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 flex-shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setErro(''); if (confirm(`Remover "${t.nome}" do catálogo?`)) delM.mutate(t.id) }} title="Remover" className="p-1.5 text-gray-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">Remover um treinamento o tira das funções que o exigiam. Os registros já lançados nos funcionários são mantidos.</p>
      </div>
    </div>
  )
}
