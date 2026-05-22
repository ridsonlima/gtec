'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Receipt, Sparkles, Plus } from 'lucide-react'

const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5'
const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type Contrato = { id: string; number: string; name: string }

export default function EquipamentosNovaMedicaoPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contratos, setContratos] = useState<Contrato[]>([])

  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1

  const [contratoId, setContratoId]               = useState('')
  const [competenciaAno, setCompetenciaAno]       = useState(String(anoAtual))
  const [competenciaMes, setCompetenciaMes]       = useState(String(mesAtual))
  const [observacoes, setObservacoes]             = useState('')
  const [autoPopulate, setAutoPopulate]           = useState(true)

  useEffect(() => {
    fetch('/api/contracts?status=active')
      .then((r) => r.json())
      .then((d) => { if (d.data) setContratos(d.data) })
      .catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contratoId) return setError('Selecione um contrato')
    setError(''); setSaving(true)
    try {
      const res = await fetch('/api/frota/medicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId,
          competenciaAno: Number(competenciaAno),
          competenciaMes: Number(competenciaMes),
          observacoes: observacoes.trim() || null,
          moduloTipo: 'equipamento',
          itens: autoPopulate ? undefined : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao criar medição')
      router.push(`/equipamentos/medicoes/${data.data.id}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/equipamentos/medicoes" className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Nova medição
        </h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Contrato */}
        <div>
          <label className={LABEL}>Contrato *</label>
          <select
            value={contratoId}
            onChange={(e) => setContratoId(e.target.value)}
            required
            className={INPUT}
          >
            <option value="">Selecione um contrato…</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>{c.number} — {c.name}</option>
            ))}
          </select>
          {contratos.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">Carregando contratos ativos…</p>
          )}
        </div>

        {/* Competência */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Mês *</label>
            <select value={competenciaMes} onChange={(e) => setCompetenciaMes(e.target.value)} className={INPUT}>
              {MESES.map((m, i) => (
                <option key={i + 1} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Ano *</label>
            <select value={competenciaAno} onChange={(e) => setCompetenciaAno(e.target.value)} className={INPUT}>
              {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-populate */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPopulate}
              onChange={(e) => setAutoPopulate(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Popular itens automaticamente
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                O sistema vai buscar todos os ativos alocados neste contrato durante a competência e calcular os dias proporcionalmente.
              </p>
            </div>
          </label>

          {!autoPopulate && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                Você poderá adicionar itens manualmente após criar o rascunho.
              </p>
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <label className={LABEL}>Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Informações adicionais para a medição…"
            className={`${INPUT} resize-none`}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Link href="/equipamentos/medicoes" className="px-4 py-2 text-sm text-gray-600">Cancelar</Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Criando…' : 'Criar rascunho'}
          </button>
        </div>
      </form>
    </div>
  )
}
