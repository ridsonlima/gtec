import { Moon, AlarmClock } from 'lucide-react'

/**
 * Selos de sinalização das 3 camadas (não vista / estagnada / atrasada).
 * Presentational puro — recebe os campos já calculados por computeDemandSignals.
 */
export function DemandSignalBadges({
  d,
  showUnread = true,
  className = '',
}: {
  d: {
    unread?: boolean
    isStale?: boolean
    staleDays?: number
    overdueLevel?: 'none' | 'late' | 'very_late'
    overdueDays?: number
  }
  showUnread?: boolean
  className?: string
}) {
  const hasAny =
    (showUnread && d.unread) || d.isStale || (d.overdueLevel && d.overdueLevel !== 'none')
  if (!hasAny) return null

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {showUnread && d.unread && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full"
          title="Atualizada desde a sua última visita"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Novo
        </span>
      )}

      {d.isStale && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"
          title={`Sem evolução há ${d.staleDays} dias`}
        >
          <Moon className="w-3 h-3" />
          Parada {d.staleDays}d
        </span>
      )}

      {d.overdueLevel === 'late' && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full"
          title={`${d.overdueDays} dia(s) após o prazo`}
        >
          <AlarmClock className="w-3 h-3" />
          Atrasada {d.overdueDays}d
        </span>
      )}

      {d.overdueLevel === 'very_late' && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-300 px-1.5 py-0.5 rounded-full"
          title={`${d.overdueDays} dias após o prazo`}
        >
          <AlarmClock className="w-3 h-3" />
          Bastante atrasada {d.overdueDays}d
        </span>
      )}
    </span>
  )
}
