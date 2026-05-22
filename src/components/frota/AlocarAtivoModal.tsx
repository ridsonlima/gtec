'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Link2, Info, Calendar, Building2, MapPin } from 'lucide-react'

type Contrato = { id: string; number: string; name: string }
type Projeto  = { id: string; name: string }

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5'

export function AlocarAtivoModal({ ativoId, ativoTag, ativoDescricao, compact }: {
  ativoId: string
  ativoTag: string
  ativoDescricao?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [projetos, setProjetos]   = useState<Projeto[]>([])
  const [contratoId, setContratoId]   = useState('')
  const [projetoId, setProjetoId]     = useState('')
  const [dataInicio, setDataInicio]   = useState(new Date().toISOString().slice(0, 10))
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/contracts?status=active')
      .then((r) => r.json())
      .then((d) => setContratos(d.data ?? []))
  }, [open])

  useEffect(() => {
    if (!contratoId) { setProjetos([]); setProjetoId(''); return }
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjetos(d.data ?? []))
  }, [contratoId])

  function close() {
    setOpen(false)
    setContratoId(''); setProjetoId(''); setObservacoes(''); setError('')
    setDataInicio(new Date().toISOString().slice(0, 10))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contratoId) return setError('Selecione o contrato de destino')
    if (!dataInicio) return setError('Informe a data de início da alocação')
    setError(''); setSaving(true)
    try {
      const res = await fetch(`/api/frota/ativos/${ativoId}/alocacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId,
          projetoId: projetoId || null,
          dataInicio,
          observacoes: observacoes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao alocar')
      close(); router.refresh()
    } finally { setSaving(false) }
  }

  const contratoSelecionado = contratos.find((c) => c.id === contratoId)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={compact
          ? 'inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-700 border border-blue-300 rounded hover:bg-blue-50 transition-colors'
          : 'inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'}
        title={compact ? 'Alocar em contrato' : undefined}
      >
        <Link2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        {!compact && 'Alocar em contrato'}
        {compact && 'Alocar'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Alocar ativo em contrato</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono font-bold text-blue-700">{ativoTag}</span>
                  {ativoDescricao && <span className="ml-1">— {ativoDescricao}</span>}
                </p>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Passo 1: Contrato */}
              <div>
                <label className={LABEL}>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    1. Contrato de destino <span className="text-red-500">*</span>
                  </span>
                </label>
                <select
                  value={contratoId}
                  onChange={(e) => setContratoId(e.target.value)}
                  className={INPUT}
                  required
                >
                  <option value="">Selecione o contrato de obra…</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>{c.number} — {c.name}</option>
                  ))}
                </select>
                {contratos.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Carregando contratos ativos…</p>
                )}
                {contratoSelecionado && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    As medições mensais deste ativo serão vinculadas a <strong>{contratoSelecionado.number}</strong>
                  </div>
                )}
              </div>

              {/* Passo 2: Frente/Trecho (opcional) */}
              {projetos.length > 0 && (
                <div>
                  <label className={LABEL}>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      2. Frente de serviço / Trecho
                      <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                    </span>
                  </label>
                  <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className={INPUT}>
                    <option value="">Sem frente específica — todo o contrato</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Informe se o ativo atua em uma frente específica dentro do contrato. Isso aparece nos relatórios de medição.
                  </p>
                </div>
              )}

              {/* Passo 3: Data de início */}
              <div>
                <label className={LABEL}>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    3. Data de início da alocação <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={INPUT}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  O sistema calculará os dias proporcionais automaticamente ao gerar a medição do mês.
                </p>
              </div>

              {/* Observações */}
              <div>
                <label className={LABEL}>Observações <span className="text-gray-400 font-normal text-xs">(opcional)</span></label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  className={`${INPUT} resize-none`}
                  placeholder="Ex: Ativo mobilizado para reforço na fase de terraplenagem."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={close} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !contratoId}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Alocando…' : 'Confirmar alocação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
