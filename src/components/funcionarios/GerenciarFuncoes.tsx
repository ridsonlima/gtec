'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, X, Plus, Pencil, Trash2, Save, Loader2, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react'

interface Funcao { id: string; nome: string; treinamentos: string[] }
interface TreinoCat { id: string; nome: string; descricao: string | null }

export function GerenciarFuncoes({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['funcoes'], queryFn: () => fetch('/api/funcoes').then((r) => r.json()) })
  const funcoes: Funcao[] = data?.data ?? []
  const { data: catData } = useQuery({ queryKey: ['treinamentos'], queryFn: () => fetch('/api/treinamentos').then((r) => r.json()) })
  const catalogo: TreinoCat[] = catData?.data ?? []

  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [expandId, setExpandId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const refresh = () => { qc.invalidateQueries({ queryKey: ['funcoes'] }); qc.invalidateQueries({ queryKey: ['funcionarios'] }) }

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/funcoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() }) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setNovo(''); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const patchM = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/funcoes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setEditId(null); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const delM = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/funcoes/${id}`, { method: 'DELETE' })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: refresh,
    onError: (e: any) => setErro(e.message),
  })

  function toggleTreino(f: Funcao, nome: string) {
    const set = new Set(f.treinamentos)
    if (set.has(nome)) set.delete(nome); else set.add(nome)
    patchM.mutate({ id: f.id, payload: { treinamentos: Array.from(set) } })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Briefcase className="w-5 h-5" /> Funções</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-400 -mt-2">Cadastre as funções e marque os treinamentos exigidos por cada uma.</p>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        {/* Adicionar */}
        <div className="flex gap-2">
          <input value={novo} onChange={(e) => { setNovo(e.target.value); setErro('') }} placeholder="Nova função (ex.: Pedreiro, Eletricista)"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) createM.mutate() }} />
          <button onClick={() => createM.mutate()} disabled={!novo.trim() || createM.isPending} className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : funcoes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma função cadastrada.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {funcoes.map((f) => {
              const aberto = expandId === f.id
              return (
                <div key={f.id} className="py-2">
                  <div className="flex items-center gap-2">
                    {editId === f.id ? (
                      <>
                        <input autoFocus value={editNome} onChange={(ev) => setEditNome(ev.target.value)} className="flex-1 text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          onKeyDown={(ev) => { if (ev.key === 'Enter' && editNome.trim()) patchM.mutate({ id: f.id, payload: { nome: editNome.trim() } }) }} />
                        <button onClick={() => patchM.mutate({ id: f.id, payload: { nome: editNome.trim() } })} className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"><Save className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setExpandId(aberto ? null : f.id)} className="flex-1 flex items-center gap-2 text-left">
                          {aberto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          <span className="text-sm text-gray-800">{f.nome}</span>
                          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {f.treinamentos.length} treino(s)</span>
                        </button>
                        <button onClick={() => { setEditId(f.id); setEditNome(f.nome); setErro('') }} title="Renomear" className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setErro(''); delM.mutate(f.id) }} title="Remover" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>

                  {aberto && editId !== f.id && (
                    <div className="mt-2 ml-6 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Treinamentos necessários</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {catalogo.map((t) => {
                          const marcado = f.treinamentos.includes(t.nome)
                          return (
                            <label key={t.id} className="flex items-start gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={marcado} onChange={() => toggleTreino(f, t.nome)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 mt-0.5" />
                              <span className="min-w-0">
                                <span className="text-gray-700 font-medium">{t.nome}</span>
                                {t.descricao && <span className="text-gray-400 font-normal"> — {t.descricao}</span>}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                      {/* marcados que não estão mais no catálogo */}
                      {f.treinamentos.filter((n) => !catalogo.some((p) => p.nome === n)).map((n) => (
                        <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked onChange={() => toggleTreino(f, n)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                          <span className="text-gray-700">{n}</span>
                        </label>
                      ))}
                      <p className="text-[11px] text-gray-400">Para incluir um novo tipo de treinamento, use o botão “Treinamentos” no topo.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="text-xs text-gray-400">Renomear uma função atualiza automaticamente todos os funcionários vinculados a ela.</p>
      </div>
    </div>
  )
}

