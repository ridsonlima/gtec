'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, X, Plus, Pencil, Trash2, Save, Loader2, Ban, RotateCcw, Car } from 'lucide-react'

interface Condutor {
  id: string; nome: string; cnh: string | null; categoriaCnh: string | null
  validadeCnh: string | null; telefone: string | null; ativo: boolean
  veiculos: { id: string; tag: string; placa: string | null }[]
  _count: { multas: number }
}

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : null

export function CondutoresManager({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['condutores'], queryFn: () => fetch('/api/condutores').then((r) => r.json()) })
  const condutores: Condutor[] = data?.data ?? []

  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', cnh: '', categoriaCnh: '', validadeCnh: '', telefone: '' })
  const [erro, setErro] = useState('')
  const novo = editId === 'novo'

  const refresh = () => qc.invalidateQueries({ queryKey: ['condutores'] })
  const startNovo = () => { setEditId('novo'); setForm({ nome: '', cnh: '', categoriaCnh: '', validadeCnh: '', telefone: '' }); setErro('') }
  const startEdit = (c: Condutor) => { setEditId(c.id); setForm({ nome: c.nome, cnh: c.cnh ?? '', categoriaCnh: c.categoriaCnh ?? '', validadeCnh: c.validadeCnh ? c.validadeCnh.slice(0, 10) : '', telefone: c.telefone ?? '' }); setErro('') }

  const saveM = useMutation({
    mutationFn: async () => {
      const body = { nome: form.nome.trim(), cnh: form.cnh || null, categoriaCnh: form.categoriaCnh || null, validadeCnh: form.validadeCnh || null, telefone: form.telefone || null }
      const res = novo
        ? await fetch('/api/condutores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/condutores/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setEditId(null); refresh() },
    onError: (e: any) => setErro(e.message),
  })

  const toggleAtivo = useMutation({
    mutationFn: async (c: Condutor) => { await fetch(`/api/condutores/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !c.ativo }) }) },
    onSuccess: refresh,
  })
  const delM = useMutation({
    mutationFn: async (id: string) => { const res = await fetch(`/api/condutores/${id}`, { method: 'DELETE' }); const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro') },
    onSuccess: refresh, onError: (e: any) => setErro(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5" /> Condutores</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}

        {!editId && (
          <button onClick={startNovo} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Novo condutor
          </button>
        )}

        {editId && (
          <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-600 space-y-1 sm:col-span-2"><span>Nome *</span>
                <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} className="cinput" autoFocus /></label>
              <label className="block text-xs font-medium text-gray-600 space-y-1"><span>CNH</span>
                <input value={form.cnh} onChange={(e) => setForm((p) => ({ ...p, cnh: e.target.value }))} className="cinput" /></label>
              <label className="block text-xs font-medium text-gray-600 space-y-1"><span>Categoria</span>
                <input value={form.categoriaCnh} onChange={(e) => setForm((p) => ({ ...p, categoriaCnh: e.target.value }))} className="cinput" placeholder="A, B, AB, D…" /></label>
              <label className="block text-xs font-medium text-gray-600 space-y-1"><span>Validade da CNH</span>
                <input type="date" value={form.validadeCnh} onChange={(e) => setForm((p) => ({ ...p, validadeCnh: e.target.value }))} className="cinput" /></label>
              <label className="block text-xs font-medium text-gray-600 space-y-1"><span>Telefone</span>
                <input value={form.telefone} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} className="cinput" /></label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
              <button onClick={() => saveM.mutate()} disabled={saveM.isPending || !form.nome.trim()} className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saveM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : condutores.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum condutor cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
            {condutores.map((c) => (
              <div key={c.id} className={`py-2.5 flex items-start gap-2 ${!c.ativo ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{c.nome}</span>
                    {c.categoriaCnh && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">CNH {c.categoriaCnh}</span>}
                    {!c.ativo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inativo</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.cnh && <>CNH {c.cnh}{c.validadeCnh && ` (val. ${fmt(c.validadeCnh)})`} · </>}
                    {c.telefone && <>{c.telefone} · </>}
                    {c._count.multas} multa(s)
                  </p>
                  {c.veiculos.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                      <Car className="w-3 h-3" /> {c.veiculos.map((v) => v.placa || v.tag).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(c)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggleAtivo.mutate(c)} title={c.ativo ? 'Inativar' : 'Reativar'} className="p-1.5 text-gray-400 hover:text-amber-600">{c.ativo ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                  <button onClick={() => { setErro(''); if (confirm(`Excluir condutor "${c.nome}"?`)) delM.mutate(c.id) }} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">O vínculo do condutor com o veículo (condutor atual) é feito na tela do veículo, em “Gestão do veículo”.</p>

        <style jsx global>{`
          .cinput { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
          .cinput:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
        `}</style>
      </div>
    </div>
  )
}
