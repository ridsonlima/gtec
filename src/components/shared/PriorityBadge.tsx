import { cn, PRIORITY_LABELS } from '@/lib/utils'

interface PriorityBadgeProps {
  priority: string
  className?: string
}

const priorityStyles: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-amber-600',
  medium: 'text-blue-600',
  low: 'text-gray-500',
}

const priorityDots: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const color = priorityStyles[priority] ?? 'text-gray-500'
  const dot = priorityDots[priority] ?? 'bg-gray-400'

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', color, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  )
}
