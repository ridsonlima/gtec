'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp } from 'lucide-react'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Adiantamento {
  id: string
  valor: number
  dataAdiantamento: string
  descricao: string | null
}

interface Medicao {
  id: string
  competenciaAno: number
  competenciaMes: number
  valorProduzido: number
  valorAprovado: number
  valorFaturado: number
  observacoes: string | null
  adiantamentos: Adiantamento[]
}

interface ContractPartnerSimple {
  id: string
  percentageTotal: number
  empresaParceira: { name: string }
}

interface Props {
  contractId: string
  medicoes: Medicao[]
  partners: ContractPartnerSimple[]
  canEdit: boolean
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtCompetencia = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`

const EMPTY_FORM = { competenciaAno: new Date().getFullYear(), competenciaMes: new Date().getMonth() + 1, valorProduzido: '', valorAprovado: '', valorFaturado: '', observacoes: '' }
const EMPTY_ADIANT = { valor: '', dataAdiantamento: new Date().toISOString().slice(0, 10), descricao: '' }

export function MedicoesSection({ contractId, medicoes, partners, canEdit }: Props) {
  const percentualTotal = partners.reduce((s, p) => s + p.percentageTotal, 0)
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingAdiantId, setAddingAdiantId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY_FORM>>({})
  const [adiantForm, setAdiantForm] = useState(EMPTY_ADIANT)
  const [loading, setLoading] = useState(false)

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const setEF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))
  const setAF = (k: keyof typeof adiantForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAdiantForm((f) => ({ ...f, [k]: e.target.value }))

  async function criarMedicao(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/medicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setAdding(false)
    setForm(EMPTY_FORM)
    router.refresh()
  }

  async function salvarEdicao(medicaoId: string) {
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/medicoes/${medicaoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setLoading(false)
    setEditingId(null)
    router.refresh()
  }

  async function excluirMedicao(medicaoId: string, competencia: string) {
    if (!confirm(`Excluir medição de ${competencia}? Esta ação remove também os adiantamentos vinculados.`)) return
    await fetch(`/api/contracts/${contractId}/medicoes/${medicaoId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function adicionarAdiantamento(medicaoId: string) {
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/medicoes/${medicaoId}/adiantamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adiantForm),
    })
    setLoading(false)
    setAddingAdiantId(null)
    setAdiantForm(EMPTY_ADIANT)
    router.refresh()
  }

  async function excluirAdiantamento(medicaoId: string, adiantId: string) {
    if (!confirm('Remover este adiantamento?')) return
    await fetch(`/api/contracts/${contractId}/medicoes/${medicaoId}/adiantamentos/${adiantId}`, { method: 'DELETE' })
    router.refresh()
  }

  const totais = medicoes.reduce(
    (acc, m) => {
      const somaAdiant = m.adiantamentos.reduce((s, a) => s + a.valor, 0)
      const repasse = (m.valorFaturado * percentualTotal) / 100
      return {
        produzido: acc.produzido + m.valorProduzido,
        aprovado: acc.aprovado + m.valorAprovado,
        faturado: acc.faturado + m.valorFaturado,
        contestacao: acc.contestacao + (m.valorProduzido - m.valorAprovado),
        prateleira: acc.prateleira + (m.valorAprovado - m.valorFaturado),
        repasse: acc.repasse + repasse,
        adiantamentos: acc.adiantamentos + somaAdiant,
        repasse_liq: acc.repasse_liq + (repasse - somaAdiant),
      }
    },
    { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, adiantamentos: 0, repasse_liq: 0 }
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4" />
          Medições ({medicoes.length})
        </h2>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" />Nova medição
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={criarMedicao} className="border border-blue-100 bg-blue-50/30 rounded-lg p-4 space-y-3 mb-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nova medição</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Ano *</span>
              <input required type="number" value={form.competenciaAno} onChange={setF('competenciaAno')} className="input" placeholder="2026" />
            </label>
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Mês *</span>
              <select required value={form.competenciaMes} onChange={setF('competenciaMes')} className="input">
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Produzido (R$) *</span>
              <input required type="number" min="0" step="0.01" value={form.valorProduzido} onChange={setF('valorProduzido')} className="input" placeholder="0,00" />
            </label>
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Aprovado (R$) *</span>
              <input required type="number" min="0" step="0.01" value={form.valorAprovado} onChange={setF('valorAprovado')} className="input" placeholder="0,00" />
            </label>
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Faturado (R$) *</span>
              <input required type="number" min="0" step="0.01" value={form.valorFaturado} onChange={setF('valorFaturado')} className="input" placeholder="0,00" />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700 space-y-1">
            <span>Observações</span>
            <textarea value={form.observacoes} onChange={setF('observacoes')} className="input min-h-16" placeholder="Notas sobre esta competência" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />{loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM) }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" />Cancelar
            </button>
          </div>
        </form>
      )}

      {medicoes.length === 0 && !adding && (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          Nenhuma medição lançada
        </div>
      )}

      {medicoes.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Competência</th>
                  <th className="text-right pb-2 font-medium">Produzido</th>
                  <th className="text-right pb-2 font-medium text-amber-600">Contestação</th>
                  <th className="text-right pb-2 font-medium">Aprovado</th>
                  <th className="text-right pb-2 font-medium text-yellow-600">Prateleira</th>
                  <th className="text-right pb-2 font-medium">Faturado</th>
                  <th className="text-right pb-2 font-medium text-blue-600">
                    Repasse ({partners.length === 1 ? `${partners[0].percentageTotal}%` : `${percentualTotal}%`})
                  </th>
                  <th className="text-right pb-2 font-medium">Adiantamentos</th>
                  <th className="text-right pb-2 font-medium text-green-700">Repasse Líq.</th>
                  <th className="pb-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {medicoes.map((m) => {
                  const somaAdiant = m.adiantamentos.reduce((s, a) => s + a.valor, 0)
                  const contestacao = m.valorProduzido - m.valorAprovado
                  const prateleira = m.valorAprovado - m.valorFaturado
                  const repasse = (m.valorFaturado * percentualTotal) / 100
                  const repasse_liq = repasse - somaAdiant
                  const isEditing = editingId === m.id
                  const isExpanded = expandedId === m.id
                  const competencia = fmtCompetencia(m.competenciaAno, m.competenciaMes)

                  return (
                    <>
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5 pr-3 font-medium text-gray-700">{competencia}</td>
                        {isEditing ? (
                          <>
                            <td className="py-1 pr-1"><input type="number" min="0" step="0.01" defaultValue={m.valorProduzido} onChange={setEF('valorProduzido')} className="input text-xs py-1 w-28" /></td>
                            <td className="py-1 pr-1 text-amber-600 text-right">—</td>
                            <td className="py-1 pr-1"><input type="number" min="0" step="0.01" defaultValue={m.valorAprovado} onChange={setEF('valorAprovado')} className="input text-xs py-1 w-28" /></td>
                            <td className="py-1 pr-1 text-yellow-600 text-right">—</td>
                            <td className="py-1 pr-1"><input type="number" min="0" step="0.01" defaultValue={m.valorFaturado} onChange={setEF('valorFaturado')} className="input text-xs py-1 w-28" /></td>
                            <td colSpan={3} className="py-1 pr-1 text-gray-400 text-right text-xs">recalculado ao salvar</td>
                            <td className="py-1 pl-1">
                              <div className="flex gap-1">
                                <button onClick={() => salvarEdicao(m.id)} disabled={loading} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Save className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 pr-3 text-right text-gray-700">{fmt(m.valorProduzido)}</td>
                            <td className={`py-2.5 pr-3 text-right font-medium ${contestacao > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{contestacao > 0 ? fmt(contestacao) : '—'}</td>
                            <td className="py-2.5 pr-3 text-right text-gray-700">{fmt(m.valorAprovado)}</td>
                            <td className={`py-2.5 pr-3 text-right font-medium ${prateleira > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>{prateleira > 0 ? fmt(prateleira) : '—'}</td>
                            <td className="py-2.5 pr-3 text-right text-gray-700">{fmt(m.valorFaturado)}</td>
                            <td className="py-2.5 pr-3 text-right text-blue-600 font-medium" title={partners.map(p => `${p.empresaParceira.name}: ${p.percentageTotal}%`).join(' + ')}>{fmt(repasse)}</td>
                            <td className="py-2.5 pr-3 text-right text-gray-500">{somaAdiant > 0 ? fmt(somaAdiant) : '—'}</td>
                            <td className={`py-2.5 pr-3 text-right font-semibold ${repasse_liq < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(repasse_liq)}</td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => setExpandedId(isExpanded ? null : m.id)} className="p-1 text-gray-300 hover:text-gray-600 rounded" title="Adiantamentos">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                {canEdit && (
                                  <>
                                    <button onClick={() => { setEditingId(m.id); setEditForm({ valorProduzido: String(m.valorProduzido), valorAprovado: String(m.valorAprovado), valorFaturado: String(m.valorFaturado) }) }} className="p-1 text-gray-300 hover:text-gray-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => excluirMedicao(m.id, competencia)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>

                      {isExpanded && (
                        <tr key={`${m.id}-adiant`}>
                          <td colSpan={10} className="pb-3 pt-1 px-2">
                            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adiantamentos — {competencia}</p>
                                {canEdit && addingAdiantId !== m.id && (
                                  <button onClick={() => setAddingAdiantId(m.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                    <Plus className="w-3 h-3" />Lançar adiantamento
                                  </button>
                                )}
                              </div>

                              {m.adiantamentos.length === 0 && addingAdiantId !== m.id && (
                                <p className="text-xs text-gray-400">Nenhum adiantamento nesta competência</p>
                              )}

                              {m.adiantamentos.map((a) => (
                                <div key={a.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-3">
                                    <span className="text-gray-400">{new Date(a.dataAdiantamento).toLocaleDateString('pt-BR')}</span>
                                    <span className="font-medium text-gray-700">{fmt(a.valor)}</span>
                                    {a.descricao && <span className="text-gray-400">{a.descricao}</span>}
                                  </div>
                                  {canEdit && (
                                    <button onClick={() => excluirAdiantamento(m.id, a.id)} className="p-1 text-gray-300 hover:text-red-500 rounded">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}

                              {addingAdiantId === m.id && (
                                <div className="flex flex-wrap items-end gap-2 pt-1">
                                  <label className="block text-xs font-medium text-gray-600 space-y-0.5">
                                    <span>Data</span>
                                    <input type="date" value={adiantForm.dataAdiantamento} onChange={setAF('dataAdiantamento')} className="input text-xs py-1" />
                                  </label>
                                  <label className="block text-xs font-medium text-gray-600 space-y-0.5">
                                    <span>Valor (R$)</span>
                                    <input type="number" min="0" step="0.01" value={adiantForm.valor} onChange={setAF('valor')} className="input text-xs py-1 w-32" placeholder="0,00" />
                                  </label>
                                  <label className="block text-xs font-medium text-gray-600 space-y-0.5 flex-1 min-w-32">
                                    <span>Descrição</span>
                                    <input value={adiantForm.descricao} onChange={setAF('descricao')} className="input text-xs py-1 w-full" placeholder="Ex: quinzenal" />
                                  </label>
                                  <div className="flex gap-1 pb-0.5">
                                    <button onClick={() => adicionarAdiantamento(m.id)} disabled={!adiantForm.valor || loading} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cdg-blue text-white text-xs rounded-lg hover:opacity-90 disabled:opacity-50">
                                      <Save className="w-3 h-3" />Salvar
                                    </button>
                                    <button onClick={() => { setAddingAdiantId(null); setAdiantForm(EMPTY_ADIANT) }} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs rounded-lg hover:bg-gray-100">
                                      <X className="w-3 h-3" />Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="text-xs font-semibold text-gray-700">
                  <td className="pt-2.5 pr-3 text-gray-500 uppercase text-xs tracking-wide">Totais</td>
                  <td className="pt-2.5 pr-3 text-right">{fmt(totais.produzido)}</td>
                  <td className={`pt-2.5 pr-3 text-right ${totais.contestacao > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{totais.contestacao > 0 ? fmt(totais.contestacao) : '—'}</td>
                  <td className="pt-2.5 pr-3 text-right">{fmt(totais.aprovado)}</td>
                  <td className={`pt-2.5 pr-3 text-right ${totais.prateleira > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>{totais.prateleira > 0 ? fmt(totais.prateleira) : '—'}</td>
                  <td className="pt-2.5 pr-3 text-right">{fmt(totais.faturado)}</td>
                  <td className="pt-2.5 pr-3 text-right text-blue-600">{fmt(totais.repasse)}</td>
                  <td className="pt-2.5 pr-3 text-right text-gray-500">{totais.adiantamentos > 0 ? fmt(totais.adiantamentos) : '—'}</td>
                  <td className={`pt-2.5 pr-3 text-right font-bold ${totais.repasse_liq < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(totais.repasse_liq)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
