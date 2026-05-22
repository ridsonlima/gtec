'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, DollarSign, AlertTriangle, Clock, Handshake, BarChart3, ChevronRight, X } from 'lucide-react'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtComp = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`

type Tab = 'geral' | 'parceiros' | 'evolucao' | 'fechamentos'

export interface DashboardMedicao {
  id: string
  contractPartnerId: string | null
  competenciaAno: number
  competenciaMes: number
  valorProduzido: number
  valorAprovado: number
  valorFaturado: number
  adiantamentos: { valor: number }[]
}

export interface DashboardPartner {
  id: string
  percentageTotal: number
  empresaParceira: { id: string; name: string; cnpj: string | null }
  instrumentos: { tipo: string; percentage: number | null }[]
}

export interface DashboardContract {
  id: string
  number: string
  name: string
  status: string
  area: { name: string }
  contractPartners: DashboardPartner[]
  medicoes: DashboardMedicao[]
}

interface Props {
  contracts: DashboardContract[]
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50 border-green-200',
  at_risk: 'text-red-700 bg-red-50 border-red-200',
  delayed: 'text-amber-700 bg-amber-50 border-amber-200',
  suspended: 'text-gray-600 bg-gray-100 border-gray-200',
  completed: 'text-blue-700 bg-blue-50 border-blue-200',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', at_risk: 'Em risco', delayed: 'Atrasado', suspended: 'Suspenso', completed: 'Concluído',
}
const TIPO_LABELS: Record<string, string> = {
  gestao_obra: 'Gestão de Obra', locacao_maquinas: 'Locação de Máq.', nota_debito: 'Nota de Débito', outro: 'Outro',
}

function calcRepasse(m: DashboardMedicao, partners: DashboardPartner[]) {
  const partner = m.contractPartnerId ? partners.find((p) => p.id === m.contractPartnerId) : null
  const pct = partner ? partner.percentageTotal : partners.reduce((s, p) => s + p.percentageTotal, 0)
  return (m.valorFaturado * pct) / 100
}

function calcTotais(medicoes: DashboardMedicao[], partners: DashboardPartner[]) {
  return medicoes.reduce(
    (acc, m) => {
      const somaAdiant = m.adiantamentos.reduce((s, a) => s + a.valor, 0)
      const repasse = calcRepasse(m, partners)
      return {
        produzido: acc.produzido + m.valorProduzido,
        aprovado: acc.aprovado + m.valorAprovado,
        faturado: acc.faturado + m.valorFaturado,
        contestacao: acc.contestacao + Math.max(0, m.valorProduzido - m.valorAprovado),
        prateleira: acc.prateleira + Math.max(0, m.valorAprovado - m.valorFaturado),
        repasse: acc.repasse + repasse,
        adiantamentos: acc.adiantamentos + somaAdiant,
        repasse_liq: acc.repasse_liq + (repasse - somaAdiant),
      }
    },
    { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, adiantamentos: 0, repasse_liq: 0 }
  )
}

export function GestaoParceirosDashboard({ contracts }: Props) {
  const [tab, setTab] = useState<Tab>('geral')
  const [filterContractId, setFilterContractId] = useState<string | null>(null)
  const [filterPartnerId, setFilterPartnerId] = useState<string | null>(null)

  // All unique EmpresaParceiras across all contracts
  const allEmpresas = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    contracts.forEach((c) =>
      c.contractPartners.forEach((cp) => {
        if (!map.has(cp.empresaParceira.id)) map.set(cp.empresaParceira.id, cp.empresaParceira)
      })
    )
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [contracts])

  // Filter contracts based on active filters
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (filterContractId && c.id !== filterContractId) return false
      if (filterPartnerId && !c.contractPartners.some((cp) => cp.empresaParceira.id === filterPartnerId)) return false
      return true
    })
  }, [contracts, filterContractId, filterPartnerId])

  // Filter medições based on partner filter within each contract
  function filteredMedicoes(c: DashboardContract) {
    if (!filterPartnerId) return c.medicoes
    const cp = c.contractPartners.find((p) => p.empresaParceira.id === filterPartnerId)
    if (!cp) return []
    return c.medicoes.filter((m) => !m.contractPartnerId || m.contractPartnerId === cp.id)
  }

  const grand = useMemo(() => {
    let acc = { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, adiantamentos: 0, repasse_liq: 0 }
    filteredContracts.forEach((c) => {
      const t = calcTotais(filteredMedicoes(c), c.contractPartners)
      acc.produzido += t.produzido; acc.aprovado += t.aprovado; acc.faturado += t.faturado
      acc.contestacao += t.contestacao; acc.prateleira += t.prateleira; acc.repasse += t.repasse
      acc.adiantamentos += t.adiantamentos; acc.repasse_liq += t.repasse_liq
    })
    return acc
  }, [filteredContracts, filterPartnerId])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'geral', label: 'Visão Geral' },
    { id: 'parceiros', label: 'Por Parceiro' },
    { id: 'evolucao', label: 'Evolução' },
    { id: 'fechamentos', label: 'Fechamentos' },
  ]

  // Alertas: contratos com repasse líquido negativo (sem filtro aplicado, sempre visível)
  const alertasNegativos = useMemo(() => {
    return contracts.filter((c) => {
      const t = calcTotais(c.medicoes, c.contractPartners)
      return t.repasse_liq < 0
    })
  }, [contracts])

  return (
    <div className="space-y-5">
      {/* Alertas de repasse negativo */}
      {alertasNegativos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">Repasse líquido negativo — adiantamentos superam o repasse</p>
          </div>
          <div className="space-y-1">
            {alertasNegativos.map((c) => {
              const t = calcTotais(c.medicoes, c.contractPartners)
              return (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-red-700">{c.name}</span>
                  <span className="font-bold text-red-700">{fmt(t.repasse_liq)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 font-medium">Filtrar:</span>
        <select
          value={filterContractId ?? ''}
          onChange={(e) => setFilterContractId(e.target.value || null)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os contratos</option>
          {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterPartnerId ?? ''}
          onChange={(e) => setFilterPartnerId(e.target.value || null)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os parceiros</option>
          {allEmpresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {(filterContractId || filterPartnerId) && (
          <button onClick={() => { setFilterContractId(null); setFilterPartnerId(null) }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Tabs — visíveis antes dos cards */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-gray-400" />} label="Produzido" value={fmt(grand.produzido)} />
        <KpiCard icon={<DollarSign className="w-4 h-4 text-blue-400" />} label="Faturado" value={fmt(grand.faturado)} color="text-blue-700" />
        <KpiCard icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} label="Contestação" value={fmt(grand.contestacao)} color={grand.contestacao > 0 ? 'text-amber-700' : 'text-gray-300'} />
        <KpiCard icon={<Clock className="w-4 h-4 text-yellow-400" />} label="Prateleira" value={fmt(grand.prateleira)} color={grand.prateleira > 0 ? 'text-yellow-700' : 'text-gray-300'} />
        <KpiCard icon={<DollarSign className="w-4 h-4 text-blue-500" />} label="Repasse bruto" value={fmt(grand.repasse)} color="text-blue-700" />
        <KpiCard icon={<DollarSign className="w-4 h-4 text-orange-400" />} label="Adiantamentos" value={fmt(grand.adiantamentos)} color="text-orange-600" />
        <KpiCard icon={<DollarSign className="w-4 h-4 text-green-500" />} label="Repasse líquido" value={fmt(grand.repasse_liq)} color={grand.repasse_liq < 0 ? 'text-red-600' : 'text-green-700'} />
        <KpiCard icon={<Handshake className="w-4 h-4 text-gray-400" />} label="Contratos ativos" value={String(filteredContracts.filter((c) => c.status === 'active').length)} />
      </div>

      {/* Tab: Visão Geral */}
      {tab === 'geral' && (
        <div className="space-y-3">
          {filteredContracts.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">Nenhum contrato nos filtros selecionados</div>
          )}
          {filteredContracts.map((c) => {
            const meds = filteredMedicoes(c)
            const t = calcTotais(meds, c.contractPartners)
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>{STATUS_LABELS[c.status] ?? c.status}</span>
                      <span className="text-xs text-gray-400 font-mono">{c.number}</span>
                      <span className="text-xs text-gray-400">{c.area.name}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  </div>
                  <Link href={`/contratos/${c.id}`} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></Link>
                </div>
                <div className="px-5 py-3 bg-gray-50/40 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <Stat label="Produzido" value={fmt(t.produzido)} />
                  <Stat label="Contestação" value={t.contestacao > 0 ? fmt(t.contestacao) : '—'} color={t.contestacao > 0 ? 'text-amber-600 font-semibold' : 'text-gray-300'} />
                  <Stat label="Prateleira" value={t.prateleira > 0 ? fmt(t.prateleira) : '—'} color={t.prateleira > 0 ? 'text-yellow-600 font-semibold' : 'text-gray-300'} />
                  <Stat label="Faturado" value={fmt(t.faturado)} />
                  <Stat label="Repasse líq." value={fmt(t.repasse_liq)} color={t.repasse_liq < 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'} />
                </div>
                <div className="divide-y divide-gray-50">
                  {c.contractPartners.map((cp) => {
                    const cpMeds = c.medicoes.filter((m) => !m.contractPartnerId || m.contractPartnerId === cp.id)
                    const cpFaturado = cpMeds.reduce((s, m) => s + m.valorFaturado, 0)
                    const repasse = (cpFaturado * cp.percentageTotal) / 100
                    const somaFixos = cp.instrumentos.filter((i) => i.tipo !== 'nota_debito' && i.percentage != null).reduce((s, i) => s + (i.percentage ?? 0), 0)
                    return (
                      <div key={cp.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-700">{cp.empresaParceira.name}</p>
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{cp.percentageTotal}%</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {cp.instrumentos.map((i, idx) => {
                              const pct = i.tipo === 'nota_debito' ? (cp.percentageTotal - somaFixos) : (i.percentage ?? 0)
                              return (
                                <span key={idx} className="text-xs bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-500">
                                  {TIPO_LABELS[i.tipo] ?? i.tipo} <span className="font-medium text-gray-700">{pct.toFixed(1)}%</span>
                                  {i.tipo === 'nota_debito' && <span className="text-amber-500 ml-1">residual</span>}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">Repasse bruto</p>
                          <p className="text-sm font-bold text-blue-700">{fmt(repasse)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Por Parceiro */}
      {tab === 'parceiros' && <TabParceiros contracts={filteredContracts} filterPartnerId={filterPartnerId} filteredMedicoes={filteredMedicoes} />}

      {/* Tab: Evolução */}
      {tab === 'evolucao' && <TabEvolucao contracts={filteredContracts} filteredMedicoes={filteredMedicoes} />}

      {/* Tab: Fechamentos */}
      {tab === 'fechamentos' && <TabFechamentos contracts={filteredContracts} filteredMedicoes={filteredMedicoes} />}
    </div>
  )
}

// ─── Tab: Por Parceiro ────────────────────────────────────────────────────────

function TabParceiros({ contracts, filterPartnerId, filteredMedicoes }: {
  contracts: DashboardContract[]
  filterPartnerId: string | null
  filteredMedicoes: (c: DashboardContract) => DashboardMedicao[]
}) {
  // Group by EmpresaParceira
  const byEmpresa = useMemo(() => {
    const map = new Map<string, {
      empresa: { id: string; name: string; cnpj: string | null }
      contratos: Array<{ contract: DashboardContract; cp: DashboardPartner; repasse: number; adiantamentos: number }>
    }>()
    contracts.forEach((c) => {
      c.contractPartners.forEach((cp) => {
        const { id, name, cnpj } = cp.empresaParceira
        if (filterPartnerId && id !== filterPartnerId) return
        if (!map.has(id)) map.set(id, { empresa: { id, name, cnpj }, contratos: [] })
        const meds = filteredMedicoes(c).filter((m) => !m.contractPartnerId || m.contractPartnerId === cp.id)
        const faturado = meds.reduce((s, m) => s + m.valorFaturado, 0)
        const repasse = (faturado * cp.percentageTotal) / 100
        const adiantamentos = meds.reduce((s, m) => s + m.adiantamentos.reduce((a, ad) => a + ad.valor, 0), 0)
        map.get(id)!.contratos.push({ contract: c, cp, repasse, adiantamentos })
      })
    })
    return Array.from(map.values()).sort((a, b) => a.empresa.name.localeCompare(b.empresa.name))
  }, [contracts, filterPartnerId])

  if (byEmpresa.length === 0) return <Empty />

  return (
    <div className="space-y-4">
      {byEmpresa.map(({ empresa, contratos }) => {
        const totalRepasse = contratos.reduce((s, c) => s + c.repasse, 0)
        const totalAdiant = contratos.reduce((s, c) => s + c.adiantamentos, 0)
        return (
          <div key={empresa.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-bold text-gray-800">{empresa.name}</p>
                  {empresa.cnpj && <span className="text-xs text-gray-400">{empresa.cnpj}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{contratos.length} contrato{contratos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Repasse líquido total</p>
                <p className={`text-lg font-bold ${(totalRepasse - totalAdiant) < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(totalRepasse - totalAdiant)}</p>
                <p className="text-xs text-gray-400">Bruto: {fmt(totalRepasse)} · Adiant: {fmt(totalAdiant)}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {contratos.map(({ contract: c, cp, repasse, adiantamentos }) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[c.status] ?? ''}`}>{STATUS_LABELS[c.status] ?? c.status}</span>
                      <span className="text-xs text-gray-400 font-mono">{c.number}</span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{cp.percentageTotal}%</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{c.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${(repasse - adiantamentos) < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(repasse - adiantamentos)}</p>
                    <p className="text-xs text-gray-400">bruto: {fmt(repasse)}</p>
                  </div>
                  <Link href={`/contratos/${c.id}`} className="p-1 text-gray-300 hover:text-gray-600 rounded"><ChevronRight className="w-4 h-4" /></Link>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Evolução ────────────────────────────────────────────────────────────

function TabEvolucao({ contracts, filteredMedicoes }: {
  contracts: DashboardContract[]
  filteredMedicoes: (c: DashboardContract) => DashboardMedicao[]
}) {
  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; ano: number; mes: number; produzido: number; aprovado: number; faturado: number; repasse: number }>()
    contracts.forEach((c) => {
      filteredMedicoes(c).forEach((m) => {
        const key = `${m.competenciaAno}-${String(m.competenciaMes).padStart(2, '0')}`
        if (!map.has(key)) map.set(key, { label: fmtComp(m.competenciaAno, m.competenciaMes), ano: m.competenciaAno, mes: m.competenciaMes, produzido: 0, aprovado: 0, faturado: 0, repasse: 0 })
        const e = map.get(key)!
        e.produzido += m.valorProduzido
        e.aprovado += m.valorAprovado
        e.faturado += m.valorFaturado
        e.repasse += calcRepasse(m, c.contractPartners)
      })
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [contracts])

  if (monthly.length === 0) return <Empty msg="Nenhuma medição para exibir evolução" />

  const maxVal = Math.max(...monthly.map((m) => Math.max(m.produzido, m.aprovado, m.faturado)))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-4 mb-6 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" />Produzido</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />Aprovado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Faturado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />Repasse</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-end gap-3 min-w-max pb-2" style={{ height: 180 }}>
          {monthly.map((m) => {
            const scale = maxVal > 0 ? 140 / maxVal : 0
            return (
              <div key={m.label} className="flex flex-col items-center gap-1 group">
                <div className="flex items-end gap-0.5" style={{ height: 140 }}>
                  <div style={{ height: Math.max(2, m.produzido * scale) }} className="w-4 bg-gray-300 rounded-t transition-all" title={`Produzido: ${fmt(m.produzido)}`} />
                  <div style={{ height: Math.max(2, m.aprovado * scale) }} className="w-4 bg-green-400 rounded-t transition-all" title={`Aprovado: ${fmt(m.aprovado)}`} />
                  <div style={{ height: Math.max(2, m.faturado * scale) }} className="w-4 bg-blue-500 rounded-t transition-all" title={`Faturado: ${fmt(m.faturado)}`} />
                  <div style={{ height: Math.max(2, m.repasse * scale) }} className="w-4 bg-blue-200 rounded-t transition-all" title={`Repasse: ${fmt(m.repasse)}`} />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabela resumo */}
      <div className="mt-5 border-t border-gray-100 pt-4 overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Competência</th>
              <th className="text-right pb-2 font-medium">Produzido</th>
              <th className="text-right pb-2 font-medium text-amber-600">Contestação</th>
              <th className="text-right pb-2 font-medium">Aprovado</th>
              <th className="text-right pb-2 font-medium text-yellow-600">Prateleira</th>
              <th className="text-right pb-2 font-medium">Faturado</th>
              <th className="text-right pb-2 font-medium text-blue-600">Repasse</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => {
              const contestacao = m.produzido - m.aprovado
              const prateleira = m.aprovado - m.faturado
              return (
                <tr key={m.label} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 pr-4 font-medium text-gray-700">{m.label}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{fmt(m.produzido)}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${contestacao > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{contestacao > 0 ? fmt(contestacao) : '—'}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{fmt(m.aprovado)}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${prateleira > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>{prateleira > 0 ? fmt(prateleira) : '—'}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{fmt(m.faturado)}</td>
                  <td className="py-2 pr-4 text-right text-blue-600 font-medium">{fmt(m.repasse)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Fechamentos ─────────────────────────────────────────────────────────

const TIPO_LABELS_SHORT: Record<string, string> = {
  gestao_obra: 'Gestão Obra', locacao_maquinas: 'Locação Máq.', nota_debito: 'Nota Déb.', outro: 'Outro',
}

interface FechamentoRow {
  label: string; ano: number; mes: number
  produzido: number; aprovado: number; faturado: number
  contestacao: number; prateleira: number; repasse: number; adiantamentos: number
  detalhes: Array<{
    contractName: string
    partnerName: string
    faturado: number
    instrumentos: Array<{ tipo: string; pct: number; valor: number }>
    adiantamentos: number
    repasse: number
  }>
}

function TabFechamentos({ contracts, filteredMedicoes }: {
  contracts: DashboardContract[]
  filteredMedicoes: (c: DashboardContract) => DashboardMedicao[]
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const rows = useMemo(() => {
    const map = new Map<string, FechamentoRow>()

    contracts.forEach((c) => {
      filteredMedicoes(c).forEach((m) => {
        const key = `${m.competenciaAno}-${String(m.competenciaMes).padStart(2, '0')}`
        if (!map.has(key)) map.set(key, {
          label: fmtComp(m.competenciaAno, m.competenciaMes), ano: m.competenciaAno, mes: m.competenciaMes,
          produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, adiantamentos: 0,
          detalhes: [],
        })
        const row = map.get(key)!
        const adiant = m.adiantamentos.reduce((s, a) => s + a.valor, 0)
        const repasse = calcRepasse(m, c.contractPartners)

        row.produzido += m.valorProduzido
        row.aprovado += m.valorAprovado
        row.faturado += m.valorFaturado
        row.contestacao += Math.max(0, m.valorProduzido - m.valorAprovado)
        row.prateleira += Math.max(0, m.valorAprovado - m.valorFaturado)
        row.repasse += repasse
        row.adiantamentos += adiant

        // Breakdown por parceiro e instrumento
        const partner = m.contractPartnerId
          ? c.contractPartners.find((p) => p.id === m.contractPartnerId)
          : c.contractPartners[0]

        if (partner) {
          const somaFixos = partner.instrumentos
            .filter((i) => i.tipo !== 'nota_debito' && i.percentage != null)
            .reduce((s, i) => s + (i.percentage ?? 0), 0)

          const instrumentos = partner.instrumentos.map((i) => {
            const pct = i.tipo === 'nota_debito' ? (partner.percentageTotal - somaFixos) : (i.percentage ?? 0)
            return { tipo: i.tipo, pct, valor: (m.valorFaturado * pct) / 100 }
          })

          row.detalhes.push({
            contractName: c.name,
            partnerName: partner.empresaParceira.name,
            faturado: m.valorFaturado,
            instrumentos,
            adiantamentos: adiant,
            repasse,
          })
        }
      })
    })
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([k, v]) => ({ key: k, ...v }))
  }, [contracts])

  if (rows.length === 0) return <Empty msg="Nenhum fechamento para exibir" />

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const liq = r.repasse - r.adiantamentos
        const isClosed = r.contestacao === 0 && r.prateleira === 0
        const hasContest = r.contestacao > 0
        const hasPrateleira = r.prateleira > 0
        const isExpanded = expandedKey === r.key

        return (
          <div key={r.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Linha resumo */}
            <button
              onClick={() => setExpandedKey(isExpanded ? null : r.key)}
              className="w-full text-left"
            >
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 px-5 py-3 hover:bg-gray-50/50 items-center">
                <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{r.label}</span>
                  {isClosed
                    ? <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">Fechado</span>
                    : <div className="flex gap-1">
                        {hasContest && <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Cont.</span>}
                        {hasPrateleira && <span className="text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full">Prat.</span>}
                      </div>
                  }
                </div>
                <StatCell label="Produzido" value={fmt(r.produzido)} />
                <StatCell label="Contestação" value={hasContest ? fmt(r.contestacao) : '—'} color={hasContest ? 'text-amber-600' : 'text-gray-300'} />
                <StatCell label="Prateleira" value={hasPrateleira ? fmt(r.prateleira) : '—'} color={hasPrateleira ? 'text-yellow-600' : 'text-gray-300'} />
                <StatCell label="Faturado" value={fmt(r.faturado)} />
                <StatCell label="Repasse" value={fmt(r.repasse)} color="text-blue-600" />
                <StatCell label="Adiant." value={r.adiantamentos > 0 ? fmt(r.adiantamentos) : '—'} color="text-orange-600" />
                <StatCell label="Líquido" value={fmt(liq)} color={liq < 0 ? 'text-red-600 font-bold' : 'text-green-700 font-bold'} />
                <div className="text-xs text-gray-400 text-right">{isExpanded ? '▲' : '▼'} fiscal</div>
              </div>
            </button>

            {/* Breakdown fiscal por instrumento */}
            {isExpanded && r.detalhes.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distribuição fiscal — {r.label}</p>
                {r.detalhes.map((d, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{d.partnerName}</p>
                        <p className="text-xs text-gray-400">{d.contractName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Faturado base</p>
                        <p className="text-sm font-bold text-gray-700">{fmt(d.faturado)}</p>
                      </div>
                    </div>
                    {d.instrumentos.length > 0 ? (
                      <div className="space-y-1">
                        {d.instrumentos.map((i, ii) => (
                          <div key={ii} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="text-gray-600">{TIPO_LABELS_SHORT[i.tipo] ?? i.tipo}</span>
                              <span className="text-gray-400">{i.pct.toFixed(2)}%</span>
                              {i.tipo === 'nota_debito' && <span className="text-amber-500 italic">residual</span>}
                            </div>
                            <span className="font-semibold text-blue-700">{fmt(i.valor)}</span>
                          </div>
                        ))}
                        <div className="border-t border-gray-100 pt-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500">Adiantamentos</span>
                          <span className="text-orange-600">{d.adiantamentos > 0 ? `−${fmt(d.adiantamentos)}` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-gray-700">Repasse líquido</span>
                          <span className={d.repasse - d.adiantamentos < 0 ? 'text-red-600' : 'text-green-700'}>{fmt(d.repasse - d.adiantamentos)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Nenhum instrumento fiscal configurado</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatCell({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className={`font-medium ${color}`}>{value}</p>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, color = 'text-gray-800' }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 mb-1 text-gray-400 text-xs">{icon}{label}</div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return <div><p className="text-gray-400 mb-0.5">{label}</p><p className={`font-medium ${color}`}>{value}</p></div>
}

function Empty({ msg = 'Nenhum dado nos filtros selecionados' }: { msg?: string }) {
  return <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">{msg}</div>
}
