'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { Session } from 'next-auth'
import { Bell, Menu, Search } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface HeaderProps {
  session: Session
  onMenuClick: () => void
  onSearchClick: () => void
}

export function Header({ session, onMenuClick, onSearchClick }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Poll de notificações a cada 30s
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?isRead=false&limit=10')
      return res.json()
    },
    refetchInterval: 30_000,
  })

  const unreadCount   = data?.data?.unreadCount ?? 0
  const notifications = data?.data?.notifications ?? []

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifOpen(false)
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center gap-2 flex-shrink-0">
      {/* Botão menu mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Botão de busca */}
      <button
        onClick={onSearchClick}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="hidden sm:inline-flex text-xs bg-white text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 ml-1">
          Ctrl K
        </kbd>
      </button>

      {/* Espaço flexível */}
      <div className="flex-1" />

      <ThemeToggle />

      {/* Notificações */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs
                             rounded-full flex items-center justify-center font-medium leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200
                          rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-800">Notificações</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((n: any) => (
                  <NotifItem key={n.id} notification={n} />
                ))
              )}
            </div>

            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                href="/notificacoes"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setNotifOpen(false)}
              >
                Ver todas as notificações
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="ml-1 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <span className="text-white text-xs font-medium">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}

function NotifItem({ notification }: { notification: any }) {
  const typeColors: Record<string, string> = {
    demand_overdue:     'bg-red-100 text-red-600',
    follow_up:          'bg-amber-100 text-amber-600',
    evidence_requested: 'bg-purple-100 text-purple-600',
    evidence_received:  'bg-green-100 text-green-600',
    demand_assigned:    'bg-blue-100 text-blue-600',
    report_published:   'bg-gray-100 text-gray-600',
    comment:            'bg-gray-100 text-gray-600',
  }

  const color = typeColors[notification.type] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors
                     ${!notification.isRead ? 'bg-blue-50/30' : ''}`}>
      <div className="flex gap-3">
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${color}`}>
          {notification.type === 'demand_overdue'     ? '!' :
           notification.type === 'follow_up'          ? '!' :
           notification.type === 'evidence_requested' ? 'Ev' :
           notification.type === 'evidence_received'  ? 'OK' :
           notification.type === 'demand_assigned'    ? '->' : 'Msg'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-800 leading-snug">
            {notification.title}
          </p>
          {notification.body && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              locale: ptBR,
              addSuffix: true,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
