'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Handshake, Plus, Trash2, Save, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  gestao_obra: 'Gestão de Obra',
  locacao_maquinas: 'Locação de Máquinas',
  nota_debito: 'Nota de Débito',
  outro: 'Outro',
}

const TIPO_COLORS: Record<string, string> = {
  gestao_obra: 'bg-blue-50 text-blue-700 border-blue-200',
  locacao_maquinas: 'bg-purple-50 text-purple-700 border-purple-200',
  nota_debito: 'bg-amber-50 text-amber-700 border-amber-200',
  outro: 'bg-gray-50 text-gray-600 border-gray-200',
}

interface InstrumentoFiscal {
  id: string
  tipo: string
  descricao: string | null
  percentage: number | null
}

interface ContractPartner {
  id: string
  percentageTotal: number
  empresaParceira: { id: string; name: string; cnpj: string | null; contactName: string | null; contactPhone: string | null }
  instrumentos: InstrumentoFiscal[]
}

interface Props {
  contractId: string
  partners: ContractPartner[]
  canEdit: boolean
}

const EMPTY_INSTR = { tipo: 'gestao_obra', descricao: '', percentage: '' }

export function ContractPartnersSection({ contractId, partners, canEdit }: Props) {
  const router = useRouter()
  const [addingPartner, setAddingPartner] = useState(false)
  const [expandedCpId, setExpandedCpId] = useState<string | null>(partners[0]?.id ?? null)
  const [addingInstrId, setAddingInstrId] = useState<string | null>(null)
  const [editingPctId, setEditingPctId] = useState<string | null>(null)
  const [newPct, setNewPct] = useState('')
  const [partnerForm, setPartnerForm] = useState({ empresaParceiraId: '', percentageTotal: '', novaEmpresa: false, nome: '', cnpj: '', contactName: '', contactPhone: '' })
  const [instrForm, setInstrForm] = useState(EMPTY_INSTR)
  const [loading, setLoading] = useState(false)

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-parceiras'],
    queryFn: () => fetch('/api/empresas-parceiras').then((r) => r.json()),
    enabled: addingPartner,
  })
  const empresas: any[] = empresasData?.data ?? []

  async function vincularParceiro(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let empresaParceiraId = partnerForm.empresaParceiraId

    if (partnerForm.novaEmpresa) {
      const res = await fetch('/api/empresas-parceiras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: partnerForm.nome, cnpj: partnerForm.cnpj, contactName: partnerForm.contactName, contactPhone: partnerForm.contactPhone }),
      })
      const data = await res.json()
      empresaParceiraId = data.data.id
    }

    await fetch(`/api/contracts/${contractId}/partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaParceiraId, percentageTotal: partnerForm.percentageTotal }),
    })

    setLoading(false)
    setAddingPartner(false)
    setPartnerForm({ empresaParceiraId: '', percentageTotal: '', novaEmpresa: false, nome: '', cnpj: '', contactName: '', contactPhone: '' })
    router.refresh()
  }

  async function removerParceiro(cpId: string, nome: string) {
    if (!confirm(`Remover parceiro "${nome}"? Os instrumentos fiscais vinculados também serão removidos.`)) return
    await fetch(`/api/contracts/${contractId}/partners/${cpId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function salvarPct(cpId: string) {
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/partners/${cpId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentageTotal: newPct }),
    })
    setLoading(false)
    setEditingPctId(null)
    router.refresh()
  }

  async function adicionarInstrumento(cpId: string, e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/partners/${cpId}/instrumentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instrForm),
    })
    setLoading(false)
    setAddingInstrId(null)
    setInstrForm(EMPTY_INSTR)
    router.refresh()
  }

  async function removerInstrumento(cpId: string, instrId: string) {
    if (!confirm('Remover este instrumento fiscal?')) return
    await fetch(`/api/contracts/${contractId}/partners/${cpId}/instrumentos/${instrId}`, { method: 'DELETE' })
    router.refresh()
  }

  const totalPct = partners.reduce((s, p) => s + p.percentageTotal, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <Handshake className="w-4 h-4" />
          Parceiros ({partners.length})
          {partners.length > 0 && (
            <span className="ml-1 text-xs font-normal text-gray-400">— {totalPct}% repassado</span>
          )}
        </h2>
        {canEdit && partners.length < 2 && !addingPartner && (
          <button onClick={() => setAddingPartner(true)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" />Vincular parceiro
          </button>
        )}
      </div>

      {partners.length === 0 && !addingPartner && (
        <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
          Nenhum parceiro vinculado
        </div>
      )}

      {/* Lista de parceiros */}
      <div className="space-y-3">
        {partners.map((cp) => {
          const somaInstrFixos = cp.instrumentos
            .filter((i) => i.tipo !== 'nota_debito' && i.percentage != null)
            .reduce((s, i) => s + (i.percentage ?? 0), 0)
          const pctNotaDebito = cp.percentageTotal - somaInstrFixos
          const isExpanded = expandedCpId === cp.id

          return (
            <div key={cp.id} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Cabeçalho do parceiro */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60">
                <button onClick={() => setExpandedCpId(isExpanded ? null : cp.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">{cp.empresaParceira.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {cp.empresaParceira.cnpj && <span className="text-xs text-gray-400">CNPJ: {cp.empresaParceira.cnpj}</span>}
                      {cp.empresaParceira.contactName && <span className="text-xs text-gray-400">{cp.empresaParceira.contactName}</span>}
                      {cp.empresaParceira.contactPhone && <span className="text-xs text-gray-400">{cp.empresaParceira.contactPhone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingPctId === cp.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input type="number" min="0" max="100" step="0.01" value={newPct} onChange={(e) => setNewPct(e.target.value)} className="input text-xs py-1 w-20" autoFocus />
                        <span className="text-xs text-gray-500">%</span>
                        <button onClick={() => salvarPct(cp.id)} disabled={loading} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Save className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingPctId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold text-blue-700">{cp.percentageTotal}%</span>
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); setEditingPctId(cp.id); setNewPct(String(cp.percentageTotal)) }} className="p-1 text-gray-300 hover:text-gray-600 rounded">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {canEdit && (
                  <button onClick={() => removerParceiro(cp.id, cp.empresaParceira.name)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Instrumentos fiscais */}
              {isExpanded && (
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instrumentos Fiscais</p>
                    {canEdit && addingInstrId !== cp.id && (
                      <button onClick={() => setAddingInstrId(cp.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" />Adicionar instrumento
                      </button>
                    )}
                  </div>

                  {cp.instrumentos.length === 0 && addingInstrId !== cp.id && (
                    <p className="text-xs text-gray-400">Nenhum instrumento cadastrado</p>
                  )}

                  <div className="space-y-1.5">
                    {cp.instrumentos.map((instr) => {
                      const pctEfetivo = instr.tipo === 'nota_debito' ? pctNotaDebito : (instr.percentage ?? 0)
                      return (
                        <div key={instr.id} className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TIPO_COLORS[instr.tipo] ?? TIPO_COLORS.outro}`}>
                            {TIPO_LABELS[instr.tipo] ?? instr.tipo}
                          </span>
                          <span className="text-xs font-semibold text-gray-700">{pctEfetivo.toFixed(2)}%</span>
                          {instr.tipo === 'nota_debito' && (
                            <span className="text-xs text-amber-600 italic">residual</span>
                          )}
                          {instr.descricao && <span className="text-xs text-gray-400">{instr.descricao}</span>}
                          {canEdit && (
                            <button onClick={() => removerInstrumento(cp.id, instr.id)} className="ml-auto p-1 text-gray-200 hover:text-red-500 rounded">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )
                    })}

                    {/* Resumo: soma dos fixos + nota de débito */}
                    {cp.instrumentos.length > 0 && (
                      <div className="pt-1.5 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                        <span>Total distribuído:</span>
                        <span className="font-medium text-gray-600">{somaInstrFixos.toFixed(2)}% em NF</span>
                        {pctNotaDebito > 0 && <span className="text-amber-600">+ {pctNotaDebito.toFixed(2)}% nota de débito</span>}
                        <span className="ml-auto font-semibold text-gray-700">= {cp.percentageTotal}%</span>
                      </div>
                    )}
                  </div>

                  {/* Form novo instrumento */}
                  {addingInstrId === cp.id && (
                    <form onSubmit={(e) => adicionarInstrumento(cp.id, e)} className="bg-gray-50 rounded-lg p-3 space-y-2 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="block text-xs font-medium text-gray-600 space-y-0.5">
                          <span>Tipo *</span>
                          <select required value={instrForm.tipo} onChange={(e) => setInstrForm((f) => ({ ...f, tipo: e.target.value }))} className="input text-xs py-1">
                            <option value="gestao_obra">Gestão de Obra</option>
                            <option value="locacao_maquinas">Locação de Máquinas</option>
                            <option value="nota_debito">Nota de Débito (residual)</option>
                            <option value="outro">Outro</option>
                          </select>
                        </label>
                        {instrForm.tipo !== 'nota_debito' && (
                          <label className="block text-xs font-medium text-gray-600 space-y-0.5">
                            <span>% *</span>
                            <input required type="number" min="0" max="100" step="0.01" value={instrForm.percentage} onChange={(e) => setInstrForm((f) => ({ ...f, percentage: e.target.value }))} className="input text-xs py-1" placeholder="0.00" />
                          </label>
                        )}
                        <label className="block text-xs font-medium text-gray-600 space-y-0.5">
                          <span>Descrição</span>
                          <input value={instrForm.descricao} onChange={(e) => setInstrForm((f) => ({ ...f, descricao: e.target.value }))} className="input text-xs py-1" placeholder="Opcional" />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={loading} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cdg-blue text-white text-xs rounded-lg hover:opacity-90 disabled:opacity-50">
                          <Save className="w-3 h-3" />Salvar
                        </button>
                        <button type="button" onClick={() => { setAddingInstrId(null); setInstrForm(EMPTY_INSTR) }} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs rounded-lg">
                          <X className="w-3 h-3" />Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Form vincular novo parceiro */}
      {addingPartner && (
        <form onSubmit={vincularParceiro} className="mt-3 border border-blue-100 bg-blue-50/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Vincular parceiro</p>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="radio" checked={!partnerForm.novaEmpresa} onChange={() => setPartnerForm((f) => ({ ...f, novaEmpresa: false }))} />
              Empresa já cadastrada
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="radio" checked={partnerForm.novaEmpresa} onChange={() => setPartnerForm((f) => ({ ...f, novaEmpresa: true }))} />
              Nova empresa
            </label>
          </div>

          {!partnerForm.novaEmpresa ? (
            <label className="block text-sm font-medium text-gray-700 space-y-1">
              <span>Empresa parceira *</span>
              <select required value={partnerForm.empresaParceiraId} onChange={(e) => setPartnerForm((f) => ({ ...f, empresaParceiraId: e.target.value }))} className="input">
                <option value="">Selecione</option>
                {empresas.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}{e.cnpj ? ` — ${e.cnpj}` : ''}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-gray-700 space-y-1">
                <span>Razão social *</span>
                <input required value={partnerForm.nome} onChange={(e) => setPartnerForm((f) => ({ ...f, nome: e.target.value }))} className="input" />
              </label>
              <label className="block text-sm font-medium text-gray-700 space-y-1">
                <span>CNPJ</span>
                <input value={partnerForm.cnpj} onChange={(e) => setPartnerForm((f) => ({ ...f, cnpj: e.target.value }))} className="input" placeholder="00.000.000/0001-00" />
              </label>
              <label className="block text-sm font-medium text-gray-700 space-y-1">
                <span>Contato</span>
                <input value={partnerForm.contactName} onChange={(e) => setPartnerForm((f) => ({ ...f, contactName: e.target.value }))} className="input" />
              </label>
              <label className="block text-sm font-medium text-gray-700 space-y-1">
                <span>Telefone</span>
                <input value={partnerForm.contactPhone} onChange={(e) => setPartnerForm((f) => ({ ...f, contactPhone: e.target.value }))} className="input" />
              </label>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 space-y-1">
            <span>% Total de repasse *</span>
            <div className="flex items-center gap-2">
              <input required type="number" min="0" max="100" step="0.01" value={partnerForm.percentageTotal} onChange={(e) => setPartnerForm((f) => ({ ...f, percentageTotal: e.target.value }))} className="input w-32" placeholder="0.00" />
              <span className="text-sm text-gray-500">% do faturado</span>
            </div>
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />{loading ? 'Salvando...' : 'Vincular'}
            </button>
            <button type="button" onClick={() => setAddingPartner(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" />Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
