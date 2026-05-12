import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null, fmt = 'dd/MM/yyyy') {
  if (!date) return '—'
  return format(new Date(date), fmt, { locale: ptBR })
}

export function formatDateTime(date: Date | string | null) {
  if (!date) return '—'
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function timeAgo(date: Date | string | null) {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true })
}

export function isOverdue(dueDate: Date | string) {
  return isPast(new Date(dueDate))
}

export function isDueSoon(dueDate: Date | string, days = 7) {
  const due = new Date(dueDate)
  const now = new Date()
  return isWithinInterval(due, { start: now, end: addDays(now, days) })
}

export function formatFileSize(bytes: number | bigint) {
  const b = typeof bytes === 'bigint' ? Number(bytes) : bytes
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  blocked: 'Bloqueada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
  active: 'Ativo',
  at_risk: 'Em risco',
  delayed: 'Com atraso',
  suspended: 'Suspenso',
  closed: 'Encerrado',
}

export const COMMENT_TYPE_LABELS: Record<string, string> = {
  observation: 'Observação',
  clarification: 'Esclarecimento',
  follow_up: 'Cobrança',
  evidence_request: 'Solicitação de Evidência',
}
