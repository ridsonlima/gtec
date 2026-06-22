export type Frequencia = 'diaria' | 'semanal' | 'mensal'

export const FREQUENCIA_LABEL: Record<Frequencia, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return { year: d.getUTCFullYear(), week }
}

/** Chave única do ciclo atual de uma rotina, conforme a frequência. */
export function periodKey(freq: Frequencia, date = new Date()): string {
  if (freq === 'diaria') return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  if (freq === 'mensal') return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  const { year, week } = isoWeek(date)
  return `${year}-W${pad(week)}`
}

/** Rótulo amigável do ciclo atual (ex.: "hoje", "esta semana", "este mês"). */
export function periodLabel(freq: Frequencia): string {
  if (freq === 'diaria') return 'hoje'
  if (freq === 'mensal') return 'este mês'
  return 'esta semana'
}
