'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, TrendingUp, ChevronRight, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const MESES_ORDER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

type Acidente = {
  id: string
  codigo: string | null
  nome: string
  cargo: string | null
  dataAdmissao: string | null
  dataOcorrencia: string
  trechoObra: string | null
  mes: string
  ano: number
  diasPerdidos: number
  tipoAcidente: string
  afastamento: string
  horarioAcidente: string | null
  turno: string | null
  areaLesionada: string | null
  situacaoInvestigacao: string | null
  agenteCausador: string | null
}

type TaxaFrequencia = {
  id: string
  mes: string
  ano: number
  totalEmpregados: number
  totalHorasTrabalhadas: number
  acidentesComAfastamento: number
  acidentesSemAfastamento: number
  totalAcidentes: number
  totalDiasPerdidos: number
  taxaFrequencia: number
  taxaGravidade: number
}

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AfastamentoBadge({ value }: { value: string }) {
  if (value === 'ASA')
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">ASA</span>
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">ACA</span>
}

function TipoBadge({ value }: { value: string }) {
  if (value === 'Trajeto')
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">Trajeto</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Típico</span>
}

function SituacaoBadge({ value }: { value: string | null }) {
  if (!value) return null
  if (value === 'Investigado')
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Investigado</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">Em investigação</span>
}

export function AccidentesTab() {
  const [mesFiltro, setMesFiltro] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: acidentesData, isLoading: loadingAcidentes } = useQuery({
    queryKey: ['acidentes', mesFiltro],
    queryFn: () =>
      fetch(`/api/acidentes?ano=2026${mesFiltro ? `&mes=${mesFiltro}` : ''}`).then((r) => r.json()),
  })

  const { data: taxasData, isLoading: loadingTaxas } = useQuery({
    queryKey: ['taxa-frequencia'],
    queryFn: () => fetch('/api/taxa-frequencia?ano=2026').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const acidentes: Acidente[] = acidentesData?.data ?? []
  const allAcidentes: Acidente[] = useMemo(() => acidentesData?.data ?? [], [acidentesData])
  const taxas: TaxaFrequencia[] = ((taxasData?.data ?? []) as TaxaFrequencia[]).sort(
    (a, b) => MESES_ORDER.indexOf(a.mes) - MESES_ORDER.indexOf(b.mes),
  )

  const totalAcidentes = allAcidentes.length
  const comAfastamento = allAcidentes.filter((a) => a.afastamento === 'ASA').length
  const totalDiasPerdidos = allAcidentes.reduce((sum, a) => sum + (a.diasPerdidos ?? 0), 0)
  const ultimaTaxa = taxas.length > 0 ? taxas[taxas.length - 1] : null

  const mesesDisponiveis = Array.from(new Set(allAcidentes.map((a) => a.mes))).sort(
    (a, b) => MESES_ORDER.indexOf(a) - MESES_ORDER.indexOf(b),
  )

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de Acidentes" value={totalAcidentes} sub="Jan–Abr 2026" icon={AlertTriangle} color="bg-red-50 text-red-600" />
        <KpiCard label="Com Afastamento (ASA)" value={comAfastamento} sub={`${totalAcidentes - comAfastamento} sem afastamento`} icon={Calendar} color="bg-amber-50 text-amber-600" />
        <KpiCard label="Dias Perdidos" value={totalDiasPerdidos} sub="acumulado no ano" icon={Clock} color="bg-orange-50 text-orange-600" />
        <KpiCard
          label="Taxa de Frequência"
          value={ultimaTaxa ? ultimaTaxa.taxaFrequencia.toFixed(2) : '—'}
          sub={ultimaTaxa ? `último mês: ${ultimaTaxa.mes}` : 'sem dados'}
          icon={TrendingUp}
          color="bg-blue-50 text-blue-600"
        />
      </div>

      {/* Indicadores mensais */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Indicadores Mensais</span>
        </div>
        {loadingTaxas ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Mês', 'Empregados', 'Horas Trab.', 'Acidentes', 'ASA', 'ACA', 'Dias Perd.', 'TF', 'TG'].map((h) => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-gray-600 text-xs ${h === 'Mês' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {taxas.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{t.mes}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{t.totalEmpregados}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{t.totalHorasTrabalhadas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">{t.totalAcidentes}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">{t.acidentesComAfastamento}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600 font-medium">{t.acidentesSemAfastamento}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{t.totalDiasPerdidos}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{t.taxaFrequencia.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-purple-700">{t.taxaGravidade.toFixed(2)}</td>
                  </tr>
                ))}
                {taxas.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400 text-sm italic">Nenhum dado disponível</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50">
          <p className="text-xs text-gray-400">TF = Taxa de Frequência · TG = Taxa de Gravidade · ASA = Com Afastamento · ACA = Sem Afastamento</p>
        </div>
      </div>

      {/* Registros de acidentes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">
              Registros de Acidentes
              {!loadingAcidentes && (
                <span className="text-xs font-normal text-gray-400 ml-1">
                  ({acidentes.length}{mesFiltro ? ` em ${mesFiltro}` : ' no total'})
                </span>
              )}
            </span>
          </div>
          <select
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {loadingAcidentes ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
        ) : acidentes.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400 italic">Nenhum acidente encontrado</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {acidentes.map((a) => (
              <div key={a.id}>
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500">{a.codigo ?? '—'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{a.nome}</span>
                      <AfastamentoBadge value={a.afastamento} />
                      <TipoBadge value={a.tipoAcidente} />
                      <SituacaoBadge value={a.situacaoInvestigacao} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      {a.cargo && <span>{a.cargo}</span>}
                      <span>{formatDate(new Date(a.dataOcorrencia))}</span>
                      {a.trechoObra && <span>{a.trechoObra}</span>}
                      {a.areaLesionada && <span>Área lesionada: {a.areaLesionada}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.diasPerdidos > 0 && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        {a.diasPerdidos}d
                      </span>
                    )}
                    <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${expandedId === a.id ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {expandedId === a.id && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                      {([
                        ['Cargo', a.cargo],
                        ['Data de Admissão', a.dataAdmissao ? formatDate(new Date(a.dataAdmissao)) : null],
                        ['Data da Ocorrência', formatDate(new Date(a.dataOcorrencia))],
                        ['Horário', a.horarioAcidente],
                        ['Turno', a.turno],
                        ['Trecho / Obra', a.trechoObra],
                        ['Área Lesionada', a.areaLesionada],
                        ['Agente Causador', a.agenteCausador],
                        ['Dias Perdidos', a.diasPerdidos > 0 ? String(a.diasPerdidos) : '0'],
                        ['Situação', a.situacaoInvestigacao],
                      ] as [string, string | null][])
                        .filter(([, v]) => v != null && v !== '')
                        .map(([label, value]) => (
                          <div key={label}>
                            <p className="text-xs text-gray-400">{label}</p>
                            <p className="text-sm font-medium text-gray-700">{value}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
