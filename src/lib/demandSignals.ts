/**
 * Sinalização de demandas — 3 camadas independentes.
 *
 * Uma demanda pode acumular os três sinais ao mesmo tempo; cada um responde a
 * uma pergunta diferente e some por um motivo diferente:
 *   - unread  ("não vista")     → mudou desde a última vez que ESTE usuário abriu?
 *   - isStale ("estagnada")     → está sem evolução há STALE_THRESHOLD_DAYS+ dias?
 *   - overdue ("atrasada")      → passou do prazo? (late = 1..N-1 / very_late = N+)
 *
 * Centralizado aqui para que pipeline, lista e kanban usem exatamente a mesma regra.
 */

export const STALE_THRESHOLD_DAYS = 7
export const VERY_LATE_THRESHOLD_DAYS = 5

const CLOSED_STATUSES = ['completed', 'cancelled']

export type OverdueLevel = 'none' | 'late' | 'very_late'

export type DemandSignals = {
  unread: boolean
  staleDays: number
  isStale: boolean
  overdueDays: number
  overdueLevel: OverdueLevel
}

/** Diferença em dias inteiros entre duas datas, ignorando horário. */
function dayDiff(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0)
  const b = new Date(to); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function computeDemandSignals(opts: {
  status: string
  dueDate: Date | string | null
  updatedAt: Date | string
  createdAt: Date | string
  /** createdAt da evolução (DemandUpdate) mais recente; se ausente, usa createdAt da demanda. */
  lastActivityAt?: Date | string | null
  /** viewedAt do DemandView deste usuário; ausente = nunca visto. */
  viewedAt?: Date | string | null
  now?: Date
}): DemandSignals {
  const now = opts.now ?? new Date()
  const active = !CLOSED_STATUSES.includes(opts.status)

  const unread = !opts.viewedAt || new Date(opts.updatedAt) > new Date(opts.viewedAt)

  const lastActivity = new Date(opts.lastActivityAt ?? opts.createdAt)
  const staleDays = active ? Math.max(0, dayDiff(lastActivity, now)) : 0
  const isStale = active && staleDays >= STALE_THRESHOLD_DAYS

  let overdueDays = 0
  let overdueLevel: OverdueLevel = 'none'
  if (active && opts.dueDate) {
    const diff = dayDiff(new Date(opts.dueDate), now)
    if (diff > 0) {
      overdueDays = diff
      overdueLevel = diff >= VERY_LATE_THRESHOLD_DAYS ? 'very_late' : 'late'
    }
  }

  return { unread, staleDays, isStale, overdueDays, overdueLevel }
}
