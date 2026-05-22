'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Trash2, Package } from 'lucide-react'

type Item = {
  id: string
  diasAtivos: number
  valorUnitario: number
  totalItem: number
  observacoes: string | null
  ativo: { id: string; tag: string; descricao: string; categoria: string; tipo: string }
  projeto: { id: string; name: string } | null
}

interface Props {
  item: Item
  medicaoId: string
  canEdit: boolean
}

export function MedicaoItemRow({ item, medicaoId, canEdit }: Props) {
  const router = useRouter()
  const [editing, setEditing]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [dias, setDias]             = useState(String(item.diasAtivos))
  const [valor, setValor]           = useState(String(item.valorUnitario))
  const [obs, setObs]               = useState(item.observacoes ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  const totalPreview = Number(dias) && Number(valor)
    ? Number(dias) * Number(valor)
    : item.totalItem

  async function salvar() {
    if (!dias || !valor || Number(dias) <= 0 || Number(valor) <= 0) {
      return setError('Dias e valor unitário devem ser maiores que zero')
    }
    setError(''); setSaving(true)
    try {
      const res = await fetch(`/api/frota/medicoes/${medicaoId}/itens/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diasAtivos: Number(dias),
          valorUnitario: Number(valor),
          observacoes: obs.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao salvar')
      setEditing(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  async function remover() {
    setSaving(true)
    try {
      const res = await fetch(`/api/frota/medicoes/${medicaoId}/itens/${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Erro ao remover item'); return }
      setConfirmDel(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  function cancelar() {
    setEditing(false)
    setDias(String(item.diasAtivos))
    setValor(String(item.valorUnitario))
    setObs(item.observacoes ?? '')
    setError('')
  }

  const INPUT = 'px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full'

  return (
    <div className={`px-5 py-4 ${editing ? 'bg-blue-50/40 border-l-2 border-blue-400' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Package className="w-4 h-4 text-blue-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 font-mono">{item.ativo.tag}</p>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.ativo.categoria}</span>
            {editing && <span className="text-xs text-blue-600 font-medium">Editando</span>}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{item.ativo.descricao}</p>
          {item.projeto && <p className="text-xs text-gray-400 mt-0.5">📍 {item.projeto.name}</p>}

          {editing ? (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 items-end">
                <div className="w-28">
                  <label className="text-xs text-gray-500 block mb-1">Dias ativos *</label>
                  <input
                    type="number" min="1" max="31"
                    value={dias} onChange={(e) => setDias(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div className="w-36">
                  <label className="text-xs text-gray-500 block mb-1">Valor/dia (R$) *</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={valor} onChange={(e) => setValor(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div className="text-sm font-bold text-gray-700 pb-1.5 whitespace-nowrap">
                  = {totalPreview.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observações (ajuste manual)</label>
                <input
                  type="text"
                  value={obs} onChange={(e) => setObs(e.target.value)}
                  placeholder="Ex: 3 dias de paralisação descontados"
                  className={`${INPUT} text-xs`}
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={salvar} disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  onClick={cancelar} disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded hover:bg-gray-50"
                >
                  <X className="w-3 h-3" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                {item.diasAtivos} dias ativos
              </span>
              <span>×</span>
              <span>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/dia</span>
              {item.observacoes && (
                <span className="text-orange-600 italic">✎ {item.observacoes}</span>
              )}
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
          <p className="text-base font-bold text-gray-900">
            {item.totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>

          {canEdit && !editing && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Ajuste manual"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {confirmDel ? (
                <>
                  <button onClick={remover} disabled={saving}
                    className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                    {saving ? '…' : 'Confirmar'}
                  </button>
                  <button onClick={() => setConfirmDel(false)}
                    className="px-2 py-0.5 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-50">
                    Não
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDel(true)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Remover item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
