'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Wrench } from 'lucide-react'

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5'

export function NovaOSModal({ ativoId, ativoTag, compact }: { ativoId: string; ativoTag: string; compact?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva')
  const [descricao, setDescricao] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [executante, setExecutante] = useState('')
  const [custo, setCusto] = useState('')
  const [observacoes, setObservacoes] = useState('')

  function handleClose() { setOpen(false); setDescricao(''); setError(''); setTipo('preventiva'); setDataPrevista(''); setExecutante(''); setCusto(''); setObservacoes('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) return setError('Descrição é obrigatória')
    setError(''); setSaving(true)
    try {
      const res = await fetch('/api/frota/ordens-servico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ativoId,
          tipo,
          descricao: descricao.trim(),
          dataPrevista: dataPrevista || null,
          executante: executante.trim() || null,
          custo: custo ? Number(custo) : null,
          observacoes: observacoes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao abrir OS')
      handleClose(); router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={compact
          ? 'inline-flex items-center gap-1 px-2 py-1 text-xs text-orange-700 border border-orange-300 rounded hover:bg-orange-50 transition-colors'
          : 'inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-400 transition-colors'}
        title={compact ? 'Abrir OS' : undefined}
      >
        <Wrench className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        {!compact && 'Abrir OS'}
        {compact && 'OS'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Nova OS — {ativoTag}</h2>
              <button onClick={handleClose}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div>
                <label className={LABEL}>Tipo *</label>
                <div className="flex gap-2">
                  {(['preventiva', 'corretiva'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTipo(t)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${tipo === t ? (t === 'corretiva' ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                      {t === 'preventiva' ? 'Preventiva' : 'Corretiva'}
                    </button>
                  ))}
                </div>
                {tipo === 'corretiva' && (
                  <p className="text-xs text-red-600 mt-1.5">Atenção: OS corretiva encerra a alocação ativa e coloca o ativo em manutenção.</p>
                )}
              </div>

              <div>
                <label className={LABEL}>Descrição do serviço *</label>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descreva o serviço a realizar…" className={`${INPUT} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Data prevista</label>
                  <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Custo estimado (R$)</label>
                  <input type="number" value={custo} onChange={(e) => setCusto(e.target.value)} min="0" step="0.01" placeholder="0,00" className={INPUT} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Executante</label>
                <input type="text" value={executante} onChange={(e) => setExecutante(e.target.value)} placeholder="Empresa ou técnico responsável" className={INPUT} />
              </div>

              <div>
                <label className={LABEL}>Observações</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={`${INPUT} resize-none`} placeholder="Opcional" />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button type="submit" disabled={saving} className={`px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${tipo === 'corretiva' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {saving ? 'Abrindo…' : 'Abrir OS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
