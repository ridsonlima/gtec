'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, Plus, Trash2, Pencil, Save, X } from 'lucide-react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface ItemLocacao {
  id: string
  descricao: string
  placa: string | null
  franquiaMensal: number
  unidadeExcedente: string
  valorExcedente: number
  isActive: boolean
}

interface Props {
  contractId: string
  cpId: string
  itens: ItemLocacao[]
  canEdit: boolean
}

const EMPTY = { descricao: '', placa: '', franquiaMensal: '', unidadeExcedente: 'hora', valorExcedente: '' }

export function ItemLocacaoSection({ contractId, cpId, itens, canEdit }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY>>({})
  const [loading, setLoading] = useState(false)

  const setF = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const setEF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/partners/${cpId}/itens-locacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setAdding(false)
    setForm(EMPTY)
    router.refresh()
  }

  async function salvarEdicao(itemId: string) {
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/partners/${cpId}/itens-locacao/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setLoading(false)
    setEditingId(null)
    router.refresh()
  }

  async function excluir(itemId: string, desc: string) {
    if (!confirm(`Remover item "${desc}"?`)) return
    await fetch(`/api/contracts/${contractId}/partners/${cpId}/itens-locacao/${itemId}`, { method: 'DELETE' })
    router.refresh()
  }

  const totalFranquia = itens.filter((i) => i.isActive).reduce((s, i) => s + i.franquiaMensal, 0)

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" />
          Itens de Locação
          {itens.length > 0 && (
            <span className="font-normal text-gray-400 normal-case">
              — {itens.length} item{itens.length !== 1 ? 'ns' : ''} · franquia total {fmt(totalFranquia)}/mês
            </span>
          )}
        </p>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" />Adicionar item
          </button>
        )}
      </div>

      {itens.length === 0 && !adding && (
        <p className="text-xs text-gray-400">Nenhum item de locação cadastrado</p>
      )}

      {itens.length > 0 && (
        <div className="space-y-1.5">
          {itens.map((item) => {
            const isEditing = editingId === item.id
            return (
              <div key={item.id} className={`rounded-lg border px-3 py-2 text-xs ${item.isActive ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="block space-y-0.5 col-span-2 sm:col-span-1">
                        <span className="text-xs font-medium text-gray-600">Descrição *</span>
                        <input defaultValue={item.descricao} onChange={setEF('descricao')} className="input text-xs py-1 w-full" />
                      </label>
                      <label className="block space-y-0.5">
                        <span className="text-xs font-medium text-gray-600">Placa</span>
                        <input defaultValue={item.placa ?? ''} onChange={setEF('placa')} className="input text-xs py-1 w-full" placeholder="AAA-0000" />
                      </label>
                      <label className="block space-y-0.5">
                        <span className="text-xs font-medium text-gray-600">Franquia/mês (R$) *</span>
                        <input type="number" min="0" step="0.01" defaultValue={item.franquiaMensal} onChange={setEF('franquiaMensal')} className="input text-xs py-1 w-full" />
                      </label>
                      <label className="block space-y-0.5">
                        <span className="text-xs font-medium text-gray-600">Unidade excedente</span>
                        <select defaultValue={item.unidadeExcedente} onChange={setEF('unidadeExcedente')} className="input text-xs py-1">
                          <option value="hora">R$/hora</option>
                          <option value="km">R$/km</option>
                        </select>
                      </label>
                      <label className="block space-y-0.5">
                        <span className="text-xs font-medium text-gray-600">Valor excedente *</span>
                        <input type="number" min="0" step="0.01" defaultValue={item.valorExcedente} onChange={setEF('valorExcedente')} className="input text-xs py-1 w-full" />
                      </label>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => salvarEdicao(item.id)} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1 bg-cdg-blue text-white text-xs rounded hover:opacity-90">
                        <Save className="w-3 h-3" />Salvar
                      </button>
                      <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 text-xs rounded">
                        <X className="w-3 h-3" />Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{item.descricao}</span>
                      {item.placa && <span className="ml-2 text-gray-400 font-mono">{item.placa}</span>}
                      <span className="ml-2 text-blue-700 font-semibold">{fmt(item.franquiaMensal)}/mês</span>
                      <span className="ml-2 text-gray-400">
                        + {fmt(item.valorExcedente)}/{item.unidadeExcedente}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => { setEditingId(item.id); setEditForm({}) }} className="p-1 text-gray-300 hover:text-gray-600 rounded">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => excluir(item.id, item.descricao)} className="p-1 text-gray-300 hover:text-red-500 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {adding && (
        <form onSubmit={criar} className="mt-2 bg-blue-50/30 border border-blue-100 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="block space-y-0.5 col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-gray-600">Descrição *</span>
              <input required value={form.descricao} onChange={setF('descricao')} className="input text-xs py-1 w-full" placeholder="Ex: Caminhão Basculante Ford" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Placa</span>
              <input value={form.placa} onChange={setF('placa')} className="input text-xs py-1 w-full" placeholder="AAA-0000" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Franquia/mês (R$) *</span>
              <input required type="number" min="0" step="0.01" value={form.franquiaMensal} onChange={setF('franquiaMensal')} className="input text-xs py-1 w-full" placeholder="0,00" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Unidade excedente</span>
              <select value={form.unidadeExcedente} onChange={setF('unidadeExcedente')} className="input text-xs py-1">
                <option value="hora">R$/hora</option>
                <option value="km">R$/km</option>
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Valor excedente *</span>
              <input required type="number" min="0" step="0.01" value={form.valorExcedente} onChange={setF('valorExcedente')} className="input text-xs py-1 w-full" placeholder="0,00" />
            </label>
          </div>
          <div className="flex gap-1">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cdg-blue text-white text-xs rounded-lg hover:opacity-90">
              <Save className="w-3 h-3" />{loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY) }} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs rounded-lg">
              <X className="w-3 h-3" />Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
