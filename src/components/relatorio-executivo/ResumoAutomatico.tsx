import { Sparkles } from 'lucide-react'

interface Props {
  totalContractValue: number
  atRiskValue: number
  totalDemands30: number
  completedDemands30: number
  completionRate: number | null
  completionRatePrev: number | null
  overdueDemands: number
  pendingEvidence: number
  contractsExpiringSoonCount: number
  contractsAtRiskCount: number
  areasCriticas: number
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Resumo Executivo Automático — gera um parágrafo de leitura rápida
 * a partir dos números da operação. Sem IA: texto montado por regras.
 */
export function ResumoAutomatico(p: Props) {
  const frases: string[] = []

  // Financeiro
  if (p.totalContractValue > 0) {
    const pctRisco = p.atRiskValue > 0 ? Math.round((p.atRiskValue / p.totalContractValue) * 100) : 0
    frases.push(
      p.atRiskValue > 0
        ? `A empresa mantém ${fmt(p.totalContractValue)} em contratos ativos, dos quais ${fmt(p.atRiskValue)} (${pctRisco}%) estão em risco ou atraso.`
        : `A empresa mantém ${fmt(p.totalContractValue)} em contratos ativos, sem valor em risco no momento.`
    )
  }

  // Demandas + tendência
  if (p.totalDemands30 > 0) {
    let f = `Nos últimos 30 dias foram criadas ${p.totalDemands30} demandas e concluídas ${p.completedDemands30}`
    if (p.completionRate != null) f += ` (taxa de conclusão de ${p.completionRate}%`
    if (p.completionRate != null && p.completionRatePrev != null) {
      const delta = p.completionRate - p.completionRatePrev
      if (delta > 2) f += `, melhora de ${delta}pp frente ao período anterior`
      else if (delta < -2) f += `, queda de ${Math.abs(delta)}pp frente ao período anterior`
      else f += `, estável frente ao período anterior`
    }
    if (p.completionRate != null) f += `)`
    f += '.'
    frases.push(f)
  }

  // Riscos operacionais
  const riscos: string[] = []
  if (p.overdueDemands > 0) riscos.push(`${p.overdueDemands} demanda${p.overdueDemands > 1 ? 's' : ''} vencida${p.overdueDemands > 1 ? 's' : ''}`)
  if (p.pendingEvidence > 0) riscos.push(`${p.pendingEvidence} evidência${p.pendingEvidence > 1 ? 's' : ''} pendente${p.pendingEvidence > 1 ? 's' : ''}`)
  if (p.areasCriticas > 0) riscos.push(`${p.areasCriticas} área${p.areasCriticas > 1 ? 's' : ''} em situação crítica`)
  if (riscos.length > 0) {
    frases.push(`Pontos de atenção: ${riscos.join(', ')}.`)
  }

  // Contratos
  const contr: string[] = []
  if (p.contractsExpiringSoonCount > 0) contr.push(`${p.contractsExpiringSoonCount} contrato${p.contractsExpiringSoonCount > 1 ? 's' : ''} vence${p.contractsExpiringSoonCount > 1 ? 'm' : ''} nos próximos 30 dias`)
  if (p.contractsAtRiskCount > 0) contr.push(`${p.contractsAtRiskCount} em risco ou atraso`)
  if (contr.length > 0) {
    frases.push(`No portfólio de contratos: ${contr.join(' e ')}.`)
  }

  // Conclusão geral
  const tudoOk = p.overdueDemands === 0 && p.pendingEvidence === 0 && p.areasCriticas === 0 && p.atRiskValue === 0
  if (tudoOk) {
    frases.push('Operação sob controle: nenhum risco crítico identificado neste momento.')
  }

  if (frases.length === 0) {
    frases.push('Ainda não há dados suficientes para um resumo neste período.')
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 print:border-gray-400">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <h2 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Resumo executivo automático</h2>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed">{frases.join(' ')}</p>
    </div>
  )
}
