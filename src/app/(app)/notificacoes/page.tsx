'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timeAgo } from '@/lib/utils'
import { Bell, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, string> = {
  report_published:    '📄',
  demand_assigned:     '📋',
  demand_overdue:      '🚨',
  comment_added:       '💬',
  evidence_requested:  '🔍',
  evidence_received:   '✅',
  follow_up:           '⏰',
}

export default function NotificacoesPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => fetch('/api/notifications?limit=50').then((r) => r.json()),
  })

  const readAllMutation = useMutation({
    mutationFn: () =>
      fetch('/api/notifications/read-all', { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const notifications = data?.data ?? []
  const unreadCount   = data?.unreadCount ?? 0

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200
                       rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma notificação</p>
          <p className="text-sm text-gray-400 mt-1">Você está em dia com tudo!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {notifications.map((n: any) => (
            <NotifRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotifRow({ notification: n }: { notification: any }) {
  const icon = TYPE_ICONS[n.type] ?? 'Notifica??o'

  const inner = (
    <div className={cn(
      'px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors',
      !n.isRead && 'bg-blue-50/40'
    )}>
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-gray-800', !n.isRead && 'font-medium')}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{timeAgo(new Date(n.createdAt))}</p>
      </div>
      {!n.isRead && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
      )}
    </div>
  )

  if (n.link) {
    return <Link href={n.link}>{inner}</Link>
  }
  return <div>{inner}</div>
}
