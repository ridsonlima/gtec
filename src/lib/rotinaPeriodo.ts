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

/** Segunda-feira (00:00 local) da semana ISO informada. */
function isoWeekStart(year: number, week: number): Date {
  // 4 de janeiro está sempre na semana ISO 1
  const jan4 = new Date(year, 0, 4)
  const jan4Dow = (jan4.getDay() + 6) % 7 // 0 = segunda
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - jan4Dow)
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Fim do ciclo (prazo) a partir da chave de período. É o último instante em que
 * a entrega ainda conta como "no prazo"; passando disso sem fechamento => perdida.
 */
export function periodEnd(freq: Frequencia, periodo: string): Date {
  if (freq === 'diaria') {
    const [y, m, d] = periodo.split('-').map(Number)
    return new Date(y, m - 1, d, 23, 59, 59, 999)
  }
  if (freq === 'mensal') {
    const [y, m] = periodo.split('-').map(Number)
    return new Date(y, m, 0, 23, 59, 59, 999) // dia 0 do mês seguinte = último dia deste mês
  }
  // semanal: "YYYY-Www"
  const [yStr, wStr] = periodo.split('-W')
  const monday = isoWeekStart(Number(yStr), Number(wStr))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

/** Rótulo curto de um período histórico (ex.: "22/06/2026", "Sem 26/2026", "jun/2026"). */
export function periodShortLabel(freq: Frequencia, periodo: string): string {
  if (freq === 'diaria') {
    const [y, m, d] = periodo.split('-')
    return `${d}/${m}/${y}`
  }
  if (freq === 'mensal') {
    const [y, m] = periodo.split('-').map(Number)
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${meses[m - 1]}/${y}`
  }
  const [y, w] = periodo.split('-W')
  return `Sem ${w}/${y}`
}
