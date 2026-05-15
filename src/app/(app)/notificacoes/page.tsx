'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timeAgo } from '@/lib/utils'
import { Bell, CheckCheck, Check } from 'lucide-react'
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
            <NotifRow key={n.id} notification={n} onRead={() => qc.invalidateQueries({ queryKey: ['notifications'] })} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotifRow({ notification: n, onRead }: { notification: any; onRead: () => void }) {
  const icon = TYPE_ICONS[n.type] ?? '🔔'

  const readMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }).then((r) => r.json()),
    onSuccess: onRead,
  })

  const content = (
    <div className={cn(
      'px-4 py-3 flex items-start gap-3 transition-colors',
      !n.isRead ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-gray-50'
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
      <div className="flex items-center gap-2 flex-shrink-0">
        {!n.isRead && (
          <>
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                readMutation.mutate()
              }}
              disabled={readMutation.isPending}
              title="Marcar como lida"
              className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )

  if (n.link) {
    return <Link href={n.link}>{content}</Link>
  }
  return <div>{content}</div>
}
