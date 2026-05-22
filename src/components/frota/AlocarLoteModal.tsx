'use client'

import { useState, useEffect } from 'react'
import { X, Link2, Info, Building2, MapPin, Calendar } from 'lucide-react'

type Contrato = { id: string; number: string; name: string }
type Projeto  = { id: string; name: string }

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5'

interface Props {
  count: number
  tags: string[]
  ativoIds: string[]
  onSuccess: () => void
  onClose: () => void
}

export function AlocarLoteModal({ count, tags, ativoIds, onSuccess, onClose }: Props) {
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [projetos, setProjetos]   = useState<Projeto[]>([])
  const [contratoId, setContratoId]   = useState('')
  const [projetoId, setProjetoId]     = useState('')
  const [dataInicio, setDataInicio]   = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    fetch('/api/contracts?status=active')
      .then((r) => r.json())
      .then((d) => setContratos(d.data ?? []))
  }, [])

  useEffect(() => {
    if (!contratoId) { setProjetos([]); setProjetoId(''); return }
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjetos(d.data ?? []))
  }, [contratoId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contratoId) return setError('Selecione o contrato de destino')
    setError(''); setSaving(true)
    try {
      const res = await fetch('/api/frota/ativos/alocar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativoIds, contratoId, projetoId: projetoId || null, dataInicio }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao alocar')
      onSuccess()
    } finally { setSaving(false) }
  }

  const contratoSel = contratos.find((c) => c.id === contratoId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Alocar {count} ativos em contrato</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{tags.slice(0, 5).join(', ')}{tags.length > 5 ? ` +${tags.length - 5}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div>
            <label className={LABEL}>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                1. Contrato de destino <span className="text-red-500">*</span>
              </span>
            </label>
            <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={INPUT} required>
              <option value="">Selecione o contrato…</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>{c.number} — {c.name}</option>
              ))}
            </select>
            {contratos.length === 0 && <p className="text-xs text-gray-400 mt-1">Carregando contratos ativos…</p>}
            {contratoSel && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Todos os {count} ativos serão vinculados a <strong>{contratoSel.number}</strong>
              </div>
            )}
          </div>

          {projetos.length > 0 && (
            <div>
              <label className={LABEL}>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  2. Frente de serviço
                  <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                </span>
              </label>
              <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className={INPUT}>
                <option value="">Sem frente específica</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={LABEL}>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                3. Data de início <span className="text-red-500">*</span>
              </span>
            </label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={INPUT} required />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !contratoId}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Link2 className="w-3.5 h-3.5" />
              {saving ? 'Alocando…' : `Confirmar (${count} ativos)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
