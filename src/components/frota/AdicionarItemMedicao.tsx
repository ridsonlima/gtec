'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Check } from 'lucide-react'

type Ativo = {
  id: string
  tag: string
  descricao: string
  categoria: string
}

interface Props {
  medicaoId: string
  contratoId: string
}

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

export function AdicionarItemMedicao({ medicaoId, contratoId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [ativoId, setAtivoId] = useState('')
  const [dias, setDias] = useState('30')
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')

  useEffect(() => {
    if (!open) return
    fetch(`/api/frota/ativos?contratoId=${contratoId}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setAtivos(d.data) })
      .catch(() => {})
  }, [open])

  const totalPreview =
    Number(dias) > 0 && Number(valor) > 0
      ? (Number(dias) * Number(valor)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null

  function reset() {
    setAtivoId(''); setDias('30'); setValor(''); setObs(''); setError('')
  }

  function fechar() { setOpen(false); reset() }

  async function salvar() {
    if (!ativoId) return setError('Selecione um ativo')
    if (!dias || Number(dias) <= 0) return setError('Dias ativos deve ser maior que zero')
    if (!valor || Number(valor) <= 0) return setError('Valor unitário deve ser maior que zero')

    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/frota/medicoes/${medicaoId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ativoId,
          diasAtivos: Number(dias),
          valorUnitario: Number(valor),
          observacoes: obs.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao adicionar item')
      fechar()
      router.refresh()
    } finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar ativo
      </button>
    )
  }

  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-blue-600" />
          Adicionar ativo à medição
        </p>
        <button onClick={fechar} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Ativo */}
      <div>
        <label className={LABEL}>Ativo *</label>
        <select value={ativoId} onChange={(e) => setAtivoId(e.target.value)} className={INPUT}>
          <option value="">Selecione um ativo…</option>
          {ativos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tag} — {a.descricao} ({a.categoria})
            </option>
          ))}
        </select>
        {ativos.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Carregando ativos alocados neste contrato…</p>
        )}
      </div>

      {/* Dias + Valor */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Dias ativos *</label>
          <input
            type="number" min="1" max="31"
            value={dias} onChange={(e) => setDias(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Valor/dia (R$) *</label>
          <input
            type="number" min="0.01" step="0.01"
            value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className={INPUT}
          />
        </div>
      </div>

      {totalPreview && (
        <p className="text-sm font-semibold text-gray-700">
          Total estimado: <span className="text-blue-700">{totalPreview}</span>
        </p>
      )}

      {/* Observações */}
      <div>
        <label className={LABEL}>Observações (opcional)</label>
        <input
          type="text"
          value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Ex: Ativo incluído retroativamente"
          className={INPUT}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={fechar}
          className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={saving}
          className="inline-flex items-center gap-1 px-4 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          {saving ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}
