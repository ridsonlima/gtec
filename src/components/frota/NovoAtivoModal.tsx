'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5'

interface Props {
  defaultTipo?: 'veiculo' | 'equipamento'
}

export function NovoAtivoModal({ defaultTipo = 'equipamento' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tipo] = useState<'equipamento' | 'veiculo'>(defaultTipo)
  const [tag, setTag] = useState('')
  const [descricao, setDescricao] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anoFabricacao, setAnoFabricacao] = useState('')
  const [placa, setPlaca] = useState('')
  const [numeroserie, setNumeroserie] = useState('')
  const [valorLocacaoMensal, setValorLocacaoMensal] = useState('')
  const [observacoes, setObservacoes] = useState('')

  function resetForm() {
    setTag(''); setDescricao('')
    setMarca(''); setModelo(''); setAnoFabricacao(''); setPlaca('')
    setNumeroserie(''); setValorLocacaoMensal(''); setObservacoes(''); setError('')
  }

  function handleClose() { setOpen(false); resetForm() }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!tag.trim()) return setError('TAG é obrigatória')
    if (!descricao.trim()) return setError('Descrição é obrigatória')
    if (!valorLocacaoMensal || isNaN(Number(valorLocacaoMensal))) return setError('Valor de locação inválido')

    setError(''); setSaving(true)
    try {
      const res = await fetch('/api/frota/ativos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: tag.trim().toUpperCase(),
          tipo,
          descricao: descricao.trim(),
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          anoFabricacao: anoFabricacao || null,
          placa: placa.trim() || null,
          numeroserie: numeroserie.trim() || null,
          valorLocacaoMensal: Number(valorLocacaoMensal),
          observacoes: observacoes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao cadastrar ativo')
      handleClose()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Novo {tipo === 'veiculo' ? 'veículo' : 'equipamento'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                Cadastrar {tipo === 'veiculo' ? 'veículo' : 'equipamento'}
              </h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className={LABEL}>TAG * <span className="text-gray-400 font-normal">(único)</span></label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  placeholder={tipo === 'equipamento' ? 'EQP-001' : 'VEI-001'}
                  className={INPUT}
                />
              </div>

              <div>
                <label className={LABEL}>Descrição *</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={tipo === 'equipamento' ? 'Ex.: Escavadeira Hidráulica 20t' : 'Ex.: Caminhão Basculante 10m³'}
                  className={INPUT}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL}>Marca</label>
                  <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Caterpillar" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Modelo</label>
                  <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="320D" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Ano</label>
                  <input type="number" value={anoFabricacao} onChange={(e) => setAnoFabricacao(e.target.value)} placeholder="2020" min="1990" max="2099" className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {tipo === 'veiculo' && (
                  <div>
                    <label className={LABEL}>Placa</label>
                    <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC-1D23" className={INPUT} />
                  </div>
                )}
                <div className={tipo === 'veiculo' ? '' : 'col-span-2'}>
                  <label className={LABEL}>Nº de Série / Chassi</label>
                  <input type="text" value={numeroserie} onChange={(e) => setNumeroserie(e.target.value)} placeholder="Opcional" className={INPUT} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Valor de locação / mês (R$) *</label>
                <input type="number" value={valorLocacaoMensal} onChange={(e) => setValorLocacaoMensal(e.target.value)} placeholder="0,00" min="0" step="0.01" className={INPUT} />
              </div>

              <div>
                <label className={LABEL}>Observações</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} placeholder="Informações adicionais…" className={`${INPUT} resize-none`} />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Salvando…' : `Cadastrar ${tipo === 'veiculo' ? 'veículo' : 'equipamento'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
