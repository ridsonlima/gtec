'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Loader2, Save } from 'lucide-react'

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

interface Props {
  ativo: {
    id: string; tipo: string; categoria: string; descricao: string
    marca: string | null; modelo: string | null; anoFabricacao: number | null
    placa: string | null; numeroserie: string | null; valorLocacaoMensal: number; observacoes: string | null
  }
}

export function EditarAtivoModal({ ativo }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [f, setF] = useState({
    descricao: ativo.descricao,
    categoria: ativo.categoria,
    marca: ativo.marca ?? '',
    modelo: ativo.modelo ?? '',
    anoFabricacao: ativo.anoFabricacao != null ? String(ativo.anoFabricacao) : '',
    placa: ativo.placa ?? '',
    numeroserie: ativo.numeroserie ?? '',
    valorLocacaoMensal: String(ativo.valorLocacaoMensal ?? 0),
    observacoes: ativo.observacoes ?? '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/frota/ativos/${ativo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: f.descricao.trim(),
          categoria: f.categoria.trim(),
          marca: f.marca.trim() || null,
          modelo: f.modelo.trim() || null,
          anoFabricacao: f.anoFabricacao ? Number(f.anoFabricacao) : null,
          placa: f.placa.trim() || null,
          numeroserie: f.numeroserie.trim() || null,
          valorLocacaoMensal: Number(f.valorLocacaoMensal) || 0,
          observacoes: f.observacoes.trim() || null,
        }),
      })
      const d = await res.json()
      if (!res.ok || d?.success === false) { setError(d?.error ?? 'Erro ao salvar'); return }
      setOpen(false); router.refresh()
    } catch { setError('Falha de conexão.') } finally { setSaving(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
        <Pencil className="w-4 h-4" /> Editar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-lg my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Editar {ativo.tipo === 'veiculo' ? 'veículo' : 'equipamento'}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div>
              <label className={LABEL}>Descrição *</label>
              <input required value={f.descricao} onChange={set('descricao')} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LABEL}>Categoria</label><input value={f.categoria} onChange={set('categoria')} className={INPUT} /></div>
              <div><label className={LABEL}>Locação / mês (R$)</label><input type="number" step="0.01" value={f.valorLocacaoMensal} onChange={set('valorLocacaoMensal')} className={INPUT} /></div>
              <div><label className={LABEL}>Marca</label><input value={f.marca} onChange={set('marca')} className={INPUT} /></div>
              <div><label className={LABEL}>Modelo</label><input value={f.modelo} onChange={set('modelo')} className={INPUT} /></div>
              <div><label className={LABEL}>Ano</label><input type="number" value={f.anoFabricacao} onChange={set('anoFabricacao')} className={INPUT} /></div>
              {ativo.tipo === 'veiculo'
                ? <div><label className={LABEL}>Placa</label><input value={f.placa} onChange={set('placa')} className={INPUT} /></div>
                : <div><label className={LABEL}>Nº Série</label><input value={f.numeroserie} onChange={set('numeroserie')} className={INPUT} /></div>}
            </div>
            {ativo.tipo === 'veiculo' && (
              <div><label className={LABEL}>Nº Série / Chassi</label><input value={f.numeroserie} onChange={set('numeroserie')} className={INPUT} /></div>
            )}
            <div>
              <label className={LABEL}>Observações</label>
              <textarea value={f.observacoes} onChange={set('observacoes')} rows={2} className={`${INPUT} resize-none`} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
