import Link from 'next/link'
import { Activity, AlertTriangle, Clock, Camera, Calendar, RefreshCw, ShieldCheck, ShieldAlert, FileWarning } from 'lucide-react'

interface Props {
  contractId: string
  status: string
  demandasAbertas: number
  demandasVencidas: number
  evidenciasPendentes: number
  diasParaVencer: number | null
  reajusteVencendo: boolean
  diasReajuste: number | null
  temRiscos: boolean
}

/**
 * Resumo Executivo — "página viva" do contrato.
 * Consolida no topo a saúde, pendências e próximas ações que exigem atenção.
 */
export function ResumoExecutivo({
  contractId, status, demandasAbertas, demandasVencidas, evidenciasPendentes,
  diasParaVencer, reajusteVencendo, diasReajuste, temRiscos,
}: Props) {
  // Determina a saúde geral do contrato
  const temAlerta = demandasVencidas > 0 || evidenciasPendentes > 0 || reajusteVencendo || (diasParaVencer != null && diasParaVencer <= 30 && diasParaVencer >= 0)

  let saude: { label: string; cls: string; barra: string; icon: any }
  if (status === 'delayed') {
    saude = { label: 'Atrasado', cls: 'text-red-700', barra: 'bg-red-500', icon: ShieldAlert }
  } else if (status === 'at_risk') {
    saude = { label: 'Em risco', cls: 'text-amber-700', barra: 'bg-amber-500', icon: ShieldAlert }
  } else if (status === 'suspended') {
    saude = { label: 'Suspenso', cls: 'text-gray-600', barra: 'bg-gray-400', icon: AlertTriangle }
  } else if (status === 'completed') {
    saude = { label: 'Concluído', cls: 'text-gray-600', barra: 'bg-gray-400', icon: ShieldCheck }
  } else if (temAlerta) {
    saude = { label: 'Requer atenção', cls: 'text-amber-700', barra: 'bg-amber-500', icon: ShieldAlert }
  } else {
    saude = { label: 'Em dia', cls: 'text-green-700', barra: 'bg-green-500', icon: ShieldCheck }
  }
  const SaudeIcon = saude.icon

  // Chips de pendência (só mostra os ativos)
  const chips: { label: string; cls: string; icon: any; href?: string }[] = []
  if (demandasVencidas > 0) chips.push({ label: `${demandasVencidas} demanda${demandasVencidas > 1 ? 's' : ''} vencida${demandasVencidas > 1 ? 's' : ''}`, cls: 'text-red-700 bg-red-50 border-red-200', icon: AlertTriangle, href: '/demandas?isOverdue=true' })
  if (demandasAbertas > 0) chips.push({ label: `${demandasAbertas} aberta${demandasAbertas > 1 ? 's' : ''}`, cls: 'text-blue-700 bg-blue-50 border-blue-200', icon: Clock })
  if (evidenciasPendentes > 0) chips.push({ label: `${evidenciasPendentes} evidência${evidenciasPendentes > 1 ? 's' : ''} pendente${evidenciasPendentes > 1 ? 's' : ''}`, cls: 'text-purple-700 bg-purple-50 border-purple-200', icon: Camera })
  if (diasParaVencer != null && diasParaVencer >= 0 && diasParaVencer <= 30) chips.push({ label: `Vence em ${diasParaVencer}d`, cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: Calendar })
  if (diasParaVencer != null && diasParaVencer < 0) chips.push({ label: 'Prazo vencido', cls: 'text-red-700 bg-red-50 border-red-200', icon: Calendar })
  if (reajusteVencendo) chips.push({ label: diasReajuste != null && diasReajuste >= 0 ? `Reajuste em ${diasReajuste}d` : 'Reajuste vencido', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: RefreshCw })
  if (temRiscos) chips.push({ label: 'Riscos registrados', cls: 'text-orange-700 bg-orange-50 border-orange-200', icon: FileWarning })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex">
      {/* Barra de saúde */}
      <div className={`w-1.5 flex-shrink-0 ${saude.barra}`} />

      <div className="flex-1 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <SaudeIcon className={`w-5 h-5 ${saude.cls}`} />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Activity className="w-3 h-3" /> Resumo executivo
              </p>
              <p className={`text-base font-bold ${saude.cls}`}>{saude.label}</p>
            </div>
          </div>

          {chips.length === 0 && (
            <span className="text-sm text-green-600 font-medium">Nenhuma pendência crítica ✓</span>
          )}
        </div>

        {/* Chips de pendência */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {chips.map((chip, i) => {
              const Icon = chip.icon
              const inner = (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${chip.cls}`}>
                  <Icon className="w-3.5 h-3.5" /> {chip.label}
                </span>
              )
              return chip.href ? <Link key={i} href={chip.href}>{inner}</Link> : <span key={i}>{inner}</span>
            })}
          </div>
        )}
      </div>
    </div>
  )
}
