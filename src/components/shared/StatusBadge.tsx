import { cn, STATUS_LABELS } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  isOverdue?: boolean
  className?: string
}

const statusStyles: Record<string, string> = {
  // Demandas
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  blocked: 'bg-gray-200 text-gray-800 border-gray-300',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  // Reports
  draft: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  published: 'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
  // Contratos
  active: 'bg-green-50 text-green-700 border-green-200',
  at_risk: 'bg-red-50 text-red-700 border-red-200',
  delayed: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-gray-100 text-gray-600 border-gray-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
  // Evidências
  pending_ev: 'bg-amber-50 text-amber-700 border-amber-200',
  received: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

export function StatusBadge({ status, isOverdue, className }: StatusBadgeProps) {
  const style = isOverdue
    ? 'bg-red-50 text-red-700 border-red-200'
    : (statusStyles[status] ?? 'bg-gray-100 text-gray-600 border-gray-200')

  const label = isOverdue
    ? 'VENCIDA'
    : (STATUS_LABELS[status] ?? status)

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        style,
        className
      )}
    >
      {label}
    </span>
  )
}
