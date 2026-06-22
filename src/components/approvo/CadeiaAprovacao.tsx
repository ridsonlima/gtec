import { Check, ArrowRight } from 'lucide-react'
import type { ApprovoEtapa } from '@/types/approvo'
import { cn } from '@/lib/utils'

/**
 * Cadeia de Aprovação (alçada) — stepper horizontal que mostra cada etapa,
 * quem aprova, o que já passou e quem é o próximo aprovador (destacado).
 */
export function CadeiaAprovacao({ etapas }: { etapas: ApprovoEtapa[] }) {
  if (!etapas || etapas.length === 0) return null

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {etapas.map((e, i) => {
        const isLast = i === etapas.length - 1
        const aprovado = e.status === 'aprovado'
        const atual = e.status === 'pendente'
        return (
          <div key={e.ordem} className="flex items-stretch flex-shrink-0">
            <div
              className={cn(
                'rounded-lg border px-2.5 py-1.5 min-w-[130px]',
                atual ? 'border-blue-300 bg-blue-50' : aprovado ? 'border-green-200 bg-green-50/60' : 'border-gray-200 bg-gray-50/60'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
                  aprovado ? 'bg-green-500' : atual ? 'bg-blue-500' : 'bg-gray-300'
                )}>
                  {aprovado ? <Check className="w-2.5 h-2.5 text-white" /> : <span className="text-[9px] font-bold text-white">{e.ordem}</span>}
                </span>
                <span className={cn('text-xs font-semibold truncate', atual ? 'text-blue-800' : aprovado ? 'text-green-800' : 'text-gray-500')}>
                  {e.nome}
                </span>
              </div>
              {e.aprovador ? (
                <p className={cn('text-xs truncate mt-0.5 pl-5', atual ? 'text-blue-700 font-medium' : 'text-gray-500')}>
                  {e.aprovador}
                </p>
              ) : null}
              <p className="text-[10px] text-gray-400 truncate pl-5">
                {atual ? '⏳ Etapa atual' : aprovado ? '✓ Aprovado' : 'Na fila'}
              </p>
            </div>
            {!isLast && (
              <div className="flex items-center px-0.5">
                <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Versão compacta: só o próximo aprovador em destaque (para tabelas/cards densos). */
export function ProximoAprovador({ proximo }: { proximo: { nome: string; etapa: string; cargo?: string } | null }) {
  if (!proximo) {
    return <span className="text-xs text-gray-400">—</span>
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{proximo.nome}</p>
        <p className="text-[10px] text-gray-400 truncate">{proximo.etapa}</p>
      </div>
    </div>
  )
}
