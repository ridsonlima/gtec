'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck, Plus, ChevronDown, ChevronUp, Save, X,
  CheckCircle2, Clock, AlertCircle, Trash2, Info, Truck,
} from 'lucide-react'

// ─── Constantes ────────────────────────────────────────────────────────────────

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const HIPOTESES: Record<number, { label: string; desc: string; entradaPC: boolean; entradaND: boolean; meta90: boolean; cor: string }> = {
  1: { label: 'H1', desc: 'Terceiro · pago pela CDG · com NF',          entradaPC: false, entradaND: false, meta90: true,  cor: 'bg-green-50 text-green-700 border-green-200' },
  2: { label: 'H2', desc: 'Terceiro · pago pela CDG · sem NF',          entradaPC: false, entradaND: false, meta90: false, cor: 'bg-red-50 text-red-700 border-red-200' },
  3: { label: 'H3', desc: 'Empresa A · pago pela CDG · com NF',         entradaPC: true,  entradaND: false, meta90: true,  cor: 'bg-blue-50 text-blue-700 border-blue-200' },
  5: { label: 'H5', desc: 'Terceiro · pago pela Empresa A (reembolso)', entradaPC: true,  entradaND: true,  meta90: true,  cor: 'bg-purple-50 text-purple-700 border-purple-200' },
  6: { label: 'H6', desc: 'Folha de pagamento CDG',                     entradaPC: true,  entradaND: false, meta90: true,  cor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  7: { label: 'H7', desc: 'Empresa B · NF construção civil',            entradaPC: false, entradaND: false, meta90: true,  cor: 'bg-teal-50 text-teal-700 border-teal-200' },
  8: { label: 'H8', desc: 'Empresa B · Nota de Débito máquinas',        entradaPC: false, entradaND: false, meta90: true,  cor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  aberto:     { label: 'Aberto',     cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  pc_lancado: { label: 'PC lançado', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  nd_lancada: { label: 'ND lançada', cls: 'text-purple-700 bg-purple-50 border-purple-200' },
  fechado:    { label: 'Fechado',    cls: 'text-green-700 bg-green-50 border-green-200' },
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Transacao {
  id: string
  hipotese: number
  descricao: string
  valor: number
  beneficiario: string | null
  dataPagamento: string | null
  nfNumero: string | null
  observacoes: string | null
  createdBy: { name: string }
}

interface UsoItem {
  id: string
  itemLocacaoId: string
  horasOuKm: number
  valorFranquia: number
  valorExcedente: number
  valorTotal: number
  itemLocacao: { descricao: string; placa: string | null; unidadeExcedente: string; franquiaMensal: number; valorExcedente: number }
}

interface ItemLocacao {
  id: string
  descricao: string
  placa: string | null
  franquiaMensal: number
  unidadeExcedente: string
  valorExcedente: number
}

interface Fechamento {
  id: string
  competenciaAno: number
  competenciaMes: number
  pcContratual: number | null
  ndContratual: number | null
  ndNumero: string | null
  ndEmissao: string | null
  pcReal: number | null
  nfAdmNumero: string | null
  nfAdmValor: number | null
  adiantEmpresaA: number | null
  totalSaidaCDG: number | null
  totalComNF: number | null
  status: string
  observacoes: string | null
  createdBy: { name: string }
  transacoes: Transacao[]
  usosItens: UsoItem[]
}

interface Props {
  contractId: string
  fechamentos: Fechamento[]
  percentualAdm: number | null
  itensLocacao: ItemLocacao[]
  canEdit: boolean
}

// ─── Componente principal ───────────────────────────────────────────────────────

export function FechamentoMensalSection({ contractId, fechamentos, percentualAdm, itensLocacao, canEdit }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(fechamentos[0]?.id ?? null)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const [newForm, setNewForm] = useState({
    competenciaAno: now.getFullYear(),
    competenciaMes: now.getMonth() + 1,
  })

  async function criarFechamento(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/contracts/${contractId}/fechamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); alert(d?.error ?? 'Erro'); return }
    setAdding(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <CalendarCheck className="w-4 h-4" />
          Fechamentos Mensais ({fechamentos.length})
        </h2>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" />Novo fechamento
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={criarFechamento} className="mb-4 border border-blue-100 bg-blue-50/30 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Novo fechamento</p>
          <div className="flex gap-3 flex-wrap">
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Ano *</span>
              <input required type="number" value={newForm.competenciaAno} onChange={(e) => setNewForm((f) => ({ ...f, competenciaAno: Number(e.target.value) }))} className="input w-24" />
            </label>
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Mês *</span>
              <select required value={newForm.competenciaMes} onChange={(e) => setNewForm((f) => ({ ...f, competenciaMes: Number(e.target.value) }))} className="input">
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />{loading ? 'Criando...' : 'Criar'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg">
              <X className="w-3.5 h-3.5" />Cancelar
            </button>
          </div>
        </form>
      )}

      {fechamentos.length === 0 && !adding && (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          Nenhum fechamento lançado
        </div>
      )}

      <div className="space-y-2">
        {fechamentos.map((f) => (
          <FechamentoCard
            key={f.id}
            f={f}
            contractId={contractId}
            percentualAdm={percentualAdm}
            itensLocacao={itensLocacao}
            canEdit={canEdit}
            expanded={expandedId === f.id}
            onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Card de cada fechamento ────────────────────────────────────────────────────

function FechamentoCard({ f, contractId, percentualAdm, itensLocacao, canEdit, expanded, onToggle, onRefresh }: {
  f: Fechamento
  contractId: string
  percentualAdm: number | null
  itensLocacao: ItemLocacao[]
  canEdit: boolean
  expanded: boolean
  onToggle: () => void
  onRefresh: () => void
}) {
  const [activeTab, setActiveTab] = useState<'transacoes' | 'locacao' | 'fechamento'>('transacoes')
  const cfg = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.aberto

  const metaPct = f.totalSaidaCDG && f.totalComNF ? (f.totalComNF / f.totalSaidaCDG) * 100 : null
  const metaOk = metaPct != null && metaPct >= 90

  // Calculados a partir das transações
  const somaHip = (h: number) => f.transacoes.filter((t) => t.hipotese === h).reduce((s, t) => s + t.valor, 0)
  const h2 = somaHip(2)

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/60" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">
              {MESES[f.competenciaMes - 1]}/{f.competenciaAno}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400">{f.transacoes.length} tx</span>
            {f.pcContratual != null && (
              <span className="text-xs text-gray-500">PC: <span className="font-medium text-blue-700">{fmt(f.pcContratual)}</span></span>
            )}
            {f.ndContratual != null && (
              <span className="text-xs text-gray-500">ND: <span className="font-medium text-purple-700">{fmt(f.ndContratual)}</span></span>
            )}
            {metaPct != null && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${metaOk ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {metaOk ? '✓' : '✗'} {metaPct.toFixed(0)}%
              </span>
            )}
            {h2 > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                ⚠ {fmt(h2)} sem NF
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Abas */}
          <div className="flex border-b border-gray-100 px-4">
            {(['transacoes', ...(itensLocacao.length > 0 ? ['locacao'] : []), 'fechamento'] as const).map((tab) => {
              const labels: Record<string, string> = { transacoes: 'Transações', locacao: 'Itens Locação', fechamento: 'Fechamento' }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  {labels[tab]}
                  {tab === 'transacoes' && f.transacoes.length > 0 && (
                    <span className="ml-1 bg-gray-100 text-gray-600 px-1 rounded-full">{f.transacoes.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-4">
            {activeTab === 'transacoes' && (
              <TransacoesTab f={f} contractId={contractId} canEdit={canEdit} onRefresh={onRefresh} />
            )}
            {activeTab === 'locacao' && (
              <ItensLocacaoTab f={f} contractId={contractId} itensLocacao={itensLocacao} canEdit={canEdit} onRefresh={onRefresh} />
            )}
            {activeTab === 'fechamento' && (
              <FechamentoTab f={f} contractId={contractId} percentualAdm={percentualAdm} canEdit={canEdit} onRefresh={onRefresh} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba Transações ─────────────────────────────────────────────────────────────

function TransacoesTab({ f, contractId, canEdit, onRefresh }: {
  f: Fechamento; contractId: string; canEdit: boolean; onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    hipotese: 1,
    descricao: '',
    valor: '',
    beneficiario: '',
    dataPagamento: new Date().toISOString().slice(0, 10),
    nfNumero: '',
    observacoes: '',
  })

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/contracts/${contractId}/fechamentos/${f.id}/transacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, hipotese: Number(form.hipotese), valor: Number(form.valor) }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); alert(d?.error ?? 'Erro'); return }
    setAdding(false)
    setForm((f) => ({ ...f, descricao: '', valor: '', beneficiario: '', nfNumero: '', observacoes: '' }))
    onRefresh()
  }

  async function excluir(txId: string) {
    if (!confirm('Remover esta transação?')) return
    await fetch(`/api/contracts/${contractId}/fechamentos/${f.id}/transacoes/${txId}`, { method: 'DELETE' })
    onRefresh()
  }

  // Resumo por hipótese
  const resumo = Object.entries(HIPOTESES).map(([h, cfg]) => {
    const txs = f.transacoes.filter((t) => t.hipotese === Number(h))
    const total = txs.reduce((s, t) => s + t.valor, 0)
    return { h: Number(h), cfg, txs, total }
  }).filter((r) => r.txs.length > 0 || adding)

  const hip = Number(form.hipotese)
  const hipCfg = HIPOTESES[hip]
  const nfObrigatorio = hip === 3 // H4 é proibido, H3 exige NF

  return (
    <div className="space-y-4">
      {/* Tabela de transações agrupadas por hipótese */}
      {f.transacoes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Hip.</th>
                <th className="text-left pb-2 font-medium">Descrição</th>
                <th className="text-left pb-2 font-medium">Beneficiário</th>
                <th className="text-right pb-2 font-medium">Valor</th>
                <th className="text-left pb-2 font-medium">NF</th>
                <th className="text-left pb-2 font-medium">Data</th>
                {canEdit && <th className="pb-2 w-8" />}
              </tr>
            </thead>
            <tbody>
              {f.transacoes.map((tx) => {
                const hip = HIPOTESES[tx.hipotese]
                return (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 pr-2">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${hip?.cor ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {hip?.label ?? `H${tx.hipotese}`}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-gray-800 max-w-[180px] truncate">{tx.descricao}</td>
                    <td className="py-2 pr-2 text-gray-500">{tx.beneficiario ?? '—'}</td>
                    <td className="py-2 pr-2 text-right font-medium text-gray-800">{fmt(tx.valor)}</td>
                    <td className="py-2 pr-2 text-gray-400">{tx.nfNumero ?? '—'}</td>
                    <td className="py-2 pr-2 text-gray-400">{tx.dataPagamento ? new Date(tx.dataPagamento).toLocaleDateString('pt-BR') : '—'}</td>
                    {canEdit && (
                      <td className="py-2">
                        <button onClick={() => excluir(tx.id)} className="p-1 text-gray-200 hover:text-red-500 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr className="text-xs font-semibold text-gray-700">
                <td colSpan={3} className="pt-2 text-gray-400 uppercase tracking-wide text-xs">Total</td>
                <td className="pt-2 text-right">{fmt(f.transacoes.reduce((s, t) => s + t.valor, 0))}</td>
                <td colSpan={canEdit ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Resumo calculado */}
      {f.transacoes.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <CalcItem label="PC Contratual (H3+H5+H6)" value={fmt(f.pcContratual)} color="text-blue-700" />
          {f.ndContratual != null && <CalcItem label="ND Contratual (H5−adiant.)" value={fmt(f.ndContratual)} color="text-purple-700" />}
          {f.totalSaidaCDG != null && (
            <CalcItem
              label={`Meta 90% (${f.totalComNF != null && f.totalSaidaCDG ? ((f.totalComNF / f.totalSaidaCDG) * 100).toFixed(0) : '—'}%)`}
              value={`${fmt(f.totalComNF)} / ${fmt(f.totalSaidaCDG)}`}
              color={(f.totalComNF ?? 0) / (f.totalSaidaCDG ?? 1) >= 0.9 ? 'text-green-700' : 'text-red-600'}
            />
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(HIPOTESES).map(([h, cfg]) => (
          <span key={h} className={`text-xs px-2 py-0.5 rounded-full border ${cfg.cor}`} title={cfg.desc}>
            {cfg.label} — {cfg.desc.split(' · ')[0]}
            {cfg.meta90 ? ' ✓NF' : ' ✗NF'}
          </span>
        ))}
      </div>

      {/* Formulário novo lançamento */}
      {canEdit && (
        adding ? (
          <form onSubmit={salvar} className="bg-blue-50/30 border border-blue-100 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nova transação</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="block space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-xs font-medium text-gray-600">Hipótese *</span>
                <select required value={form.hipotese} onChange={setF('hipotese')} className="input text-xs py-1">
                  {Object.entries(HIPOTESES).map(([h, cfg]) => (
                    <option key={h} value={h}>H{h} — {cfg.desc}</option>
                  ))}
                </select>
              </label>
              {hipCfg && (
                <div className={`col-span-2 sm:col-span-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border ${hipCfg.cor}`}>
                  <Info className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {hipCfg.entradaPC && <strong>Entra no PC Contratual. </strong>}
                    {hipCfg.entradaND && <strong>Entra na ND. </strong>}
                    {hipCfg.meta90 ? 'Coberto pela meta 90%.' : <strong className="text-red-700">Não coberto pela meta 90%.</strong>}
                  </span>
                </div>
              )}
              <label className="block space-y-0.5 col-span-2">
                <span className="text-xs font-medium text-gray-600">Descrição *</span>
                <input required value={form.descricao} onChange={setF('descricao')} className="input text-xs py-1 w-full" placeholder="Ex: Compra de material de construção" />
              </label>
              <label className="block space-y-0.5">
                <span className="text-xs font-medium text-gray-600">Valor (R$) *</span>
                <input required type="number" min="0" step="0.01" value={form.valor} onChange={setF('valor')} className="input text-xs py-1" placeholder="0,00" />
              </label>
              <label className="block space-y-0.5">
                <span className="text-xs font-medium text-gray-600">Beneficiário</span>
                <input value={form.beneficiario} onChange={setF('beneficiario')} className="input text-xs py-1" placeholder="Ex: Fornecedor Ltda" />
              </label>
              <label className="block space-y-0.5">
                <span className="text-xs font-medium text-gray-600">Data pagamento</span>
                <input type="date" value={form.dataPagamento} onChange={setF('dataPagamento')} className="input text-xs py-1" />
              </label>
              <label className="block space-y-0.5">
                <span className="text-xs font-medium text-gray-600">Nº da NF{nfObrigatorio ? ' *' : ''}</span>
                <input required={nfObrigatorio} value={form.nfNumero} onChange={setF('nfNumero')} className="input text-xs py-1" placeholder="000000" />
              </label>
              <label className="block space-y-0.5 col-span-2">
                <span className="text-xs font-medium text-gray-600">Observações</span>
                <input value={form.observacoes} onChange={setF('observacoes')} className="input text-xs py-1 w-full" />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cdg-blue text-white text-xs rounded-lg hover:opacity-90">
                <Save className="w-3 h-3" />{loading ? 'Salvando...' : 'Lançar'}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs rounded-lg">
                <X className="w-3 h-3" />Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" />Lançar transação
          </button>
        )
      )}
    </div>
  )
}

// ─── Aba Itens Locação ──────────────────────────────────────────────────────────

function ItensLocacaoTab({ f, contractId, itensLocacao, canEdit, onRefresh }: {
  f: Fechamento; contractId: string; itensLocacao: ItemLocacao[]; canEdit: boolean; onRefresh: () => void
}) {
  const [usoForm, setUsoForm] = useState<Record<string, string>>({})
  const [excForm, setExcForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const getUso = (itemId: string) => f.usosItens.find((u) => u.itemLocacaoId === itemId)

  async function salvarUso(item: ItemLocacao) {
    const horasOuKm = Number(usoForm[item.id] ?? 0)
    const excVal = excForm[item.id] != null ? Number(excForm[item.id]) : horasOuKm * item.valorExcedente
    const total = item.franquiaMensal + excVal
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/fechamentos/${f.id}/usos-itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemLocacaoId: item.id, horasOuKm, valorExcedente: excVal, valorTotal: total }),
    })
    setLoading(false)
    onRefresh()
  }

  const totalLocacao = f.usosItens.reduce((s, u) => s + u.valorTotal, 0)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Registre o uso mensal de cada equipamento. O total vira transações H7/H8 no fechamento.
      </p>
      {itensLocacao.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum item de locação cadastrado para este parceiro.</p>
      ) : (
        <div className="space-y-2">
          {itensLocacao.map((item) => {
            const uso = getUso(item.id)
            return (
              <div key={item.id} className="border border-gray-100 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-800">{item.descricao}</span>
                  {item.placa && <span className="text-xs text-gray-400 font-mono">{item.placa}</span>}
                  <span className="ml-auto text-xs text-blue-700 font-medium">franquia: {fmt(item.franquiaMensal)}/mês</span>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <label className="block space-y-0.5">
                    <span className="text-xs font-medium text-gray-600">{item.unidadeExcedente === 'km' ? 'Km rodados' : 'Horas trabalhadas'}</span>
                    <input
                      type="number" min="0" step="0.1"
                      defaultValue={uso?.horasOuKm ?? ''}
                      onChange={(e) => setUsoForm((f) => ({ ...f, [item.id]: e.target.value }))}
                      className="input text-xs py-1 w-28"
                      placeholder="0"
                    />
                  </label>
                  <label className="block space-y-0.5">
                    <span className="text-xs font-medium text-gray-600">Excedente (R$)</span>
                    <input
                      type="number" min="0" step="0.01"
                      defaultValue={uso?.valorExcedente ?? ''}
                      placeholder={`${item.valorExcedente}×${usoForm[item.id] ?? '0'}`}
                      onChange={(e) => setExcForm((f) => ({ ...f, [item.id]: e.target.value }))}
                      className="input text-xs py-1 w-28"
                    />
                  </label>
                  {uso && (
                    <div className="text-xs text-gray-500 pb-1">
                      Total: <span className="font-semibold text-gray-800">{fmt(uso.valorTotal)}</span>
                    </div>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => salvarUso(item)}
                      disabled={loading || usoForm[item.id] == null}
                      className="inline-flex items-center gap-1 px-2 py-1.5 bg-cdg-blue text-white text-xs rounded hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="w-3 h-3" />Salvar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {f.usosItens.length > 0 && (
            <div className="text-xs font-semibold text-gray-700 pt-1 flex justify-between">
              <span className="text-gray-400">Total locação</span>
              <span>{fmt(totalLocacao)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Aba Fechamento Formal ──────────────────────────────────────────────────────

function FechamentoTab({ f, contractId, percentualAdm, canEdit, onRefresh }: {
  f: Fechamento; contractId: string; percentualAdm: number | null; canEdit: boolean; onRefresh: () => void
}) {
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  const setEF = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))

  async function salvar() {
    setLoading(true)
    const payload: Record<string, any> = {}
    for (const [k, v] of Object.entries(editForm)) payload[k] = v === '' ? null : v
    await fetch(`/api/contracts/${contractId}/fechamentos/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setLoading(false)
    setEditing(false)
    onRefresh()
  }

  // Admin fee = max(PC × %, minimum)
  const taxaAdm = f.pcContratual != null && percentualAdm != null
    ? f.pcContratual * percentualAdm / 100
    : null

  // ND calculada = H5 - adiantamentos
  // PC Real = total due - adiant. - NF Empresa A (user enters this manually)
  const metaPct = f.totalSaidaCDG && f.totalComNF ? (f.totalComNF / f.totalSaidaCDG) * 100 : null

  return (
    <div className="space-y-4">
      {/* Resumo das etapas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StepSummary
          step={1} label="PC Contratual" done={f.pcContratual != null}
          value={fmt(f.pcContratual)}
          sub={taxaAdm != null ? `Taxa adm: ${fmt(taxaAdm)} (${percentualAdm}%)` : undefined}
          color="blue"
        />
        <StepSummary
          step={2} label="ND Contratual" done={f.ndContratual != null}
          value={fmt(f.ndContratual)}
          sub={f.ndNumero ? `ND nº ${f.ndNumero}` : undefined}
          color="purple"
        />
        <StepSummary
          step={3} label="PC Real" done={f.pcReal != null}
          value={fmt(f.pcReal)}
          sub={metaPct != null ? `Meta 90%: ${metaPct.toFixed(0)}% ${metaPct >= 90 ? '✓' : '✗'}` : undefined}
          color={f.pcReal != null ? 'green' : 'gray'}
        />
      </div>

      {/* Campos editáveis */}
      {editing ? (
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Registrar documentos do fechamento</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">NF Empresa A nº</span>
              <input defaultValue={f.nfAdmNumero ?? ''} onChange={setEF('nfAdmNumero')} className="input text-xs py-1" placeholder="000000" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Valor NF Empresa A (R$)</span>
              <input type="number" min="0" step="0.01" defaultValue={f.nfAdmValor ?? taxaAdm ?? ''} onChange={setEF('nfAdmValor')} className="input text-xs py-1" placeholder={taxaAdm ? String(taxaAdm.toFixed(2)) : '0,00'} />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Adiantamentos à Empresa A (R$)</span>
              <input type="number" min="0" step="0.01" defaultValue={f.adiantEmpresaA ?? ''} onChange={setEF('adiantEmpresaA')} className="input text-xs py-1" placeholder="0,00" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">ND nº</span>
              <input defaultValue={f.ndNumero ?? ''} onChange={setEF('ndNumero')} className="input text-xs py-1" placeholder="ND-000" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">Data emissão ND</span>
              <input type="date" defaultValue={f.ndEmissao ? f.ndEmissao.slice(0, 10) : ''} onChange={setEF('ndEmissao')} className="input text-xs py-1" />
            </label>
            <label className="block space-y-0.5">
              <span className="text-xs font-medium text-gray-600">PC Real (R$)</span>
              <input type="number" min="0" step="0.01" defaultValue={f.pcReal ?? ''} onChange={setEF('pcReal')} className="input text-xs py-1" placeholder="0,00" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={salvar} disabled={loading} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cdg-blue text-white text-xs rounded-lg hover:opacity-90">
              <Save className="w-3 h-3" />{loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs rounded-lg">
              <X className="w-3 h-3" />Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {f.nfAdmNumero && <InfoPair label="NF Empresa A" value={`nº ${f.nfAdmNumero} — ${fmt(f.nfAdmValor)}`} />}
            {f.adiantEmpresaA != null && <InfoPair label="Adiant. Empresa A" value={fmt(f.adiantEmpresaA)} />}
            {f.ndNumero && <InfoPair label="ND" value={`nº ${f.ndNumero}${f.ndEmissao ? ` · ${new Date(f.ndEmissao).toLocaleDateString('pt-BR')}` : ''}`} />}
          </div>
          {canEdit && (
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
              Registrar documentos do fechamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ────────────────────────────────────────────────────────────

function CalcItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function StepSummary({ step, label, done, value, sub, color }: {
  step: number; label: string; done: boolean; value: string; sub?: string; color: string
}) {
  const bg: Record<string, string> = { blue: 'bg-blue-600', purple: 'bg-purple-600', green: 'bg-green-600', gray: 'bg-gray-300' }
  return (
    <div className={`rounded-lg border p-3 ${done ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${done ? (bg[color] ?? 'bg-gray-400') : 'bg-gray-200 text-gray-500'}`}>
          {done ? '✓' : step}
        </div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
      </div>
      <p className={`text-sm font-bold ml-7 ${done ? 'text-gray-900' : 'text-gray-300'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 ml-7 mt-0.5">{sub}</p>}
    </div>
  )
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  )
}
