'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Eye, CheckCheck, ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'

type FeedItem = {
  id: string
  demandId: string
  demandTitle: string
  areaName: string
  authorName: string
  content: string
  statusAfter: string | null
  createdAt: string
  seen: boolean
}

interface Props {
  items: FeedItem[]
  unseenCount: number
}

export function DemandActivityFeed({ items: initialItems, unseenCount: initialUnseen }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [unseen, setUnseen] = useState(initialUnseen)
  const [markingAll, startMarkAll] = useTransition()

  async function markSeen(updateId: string) {
    const res = await fetch(`/api/demands/updates/${updateId}/view`, { method: 'POST' })
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.id === updateId ? { ...i, seen: true } : i))
      setUnseen((n) => Math.max(0, n - 1))
    }
  }

  function markAllSeen() {
    startMarkAll(async () => {
      const res = await fetch('/api/demands/updates/mark-all-seen', { method: 'POST' })
      if (res.ok) {
        setItems((prev) => prev.map((i) => ({ ...i, seen: true })))
        setUnseen(0)
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Evoluções das Demandas
          {unseen > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </h2>
        {unseen > 0 && (
          <button
            onClick={markAllSeen}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {markingAll ? 'Marcando…' : 'Marcar todos como visto'}
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-50 overflow-y-auto max-h-[520px]">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhuma evolução recente</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`px-5 py-3.5 flex gap-3 transition-colors ${
                !item.seen ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-gray-50/60'
              }`}
            >
              {/* Indicador não lido */}
              <div className="flex-shrink-0 mt-1.5">
                {!item.seen ? (
                  <span className="block w-2 h-2 rounded-full bg-blue-500" />
                ) : (
                  <span className="block w-2 h-2 rounded-full bg-gray-200" />
                )}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/demandas/${item.demandId}`}
                      className="text-xs font-semibold text-gray-800 hover:text-blue-600 truncate block"
                    >
                      {item.demandTitle}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.areaName} · {item.authorName} · {timeAgo(new Date(item.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.statusAfter && <StatusBadge status={item.statusAfter} />}
                    {!item.seen && (
                      <button
                        onClick={() => markSeen(item.id)}
                        title="Marcar como visto"
                        className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {item.content && (
                  <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{item.content}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <Link
            href="/demandas"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver todas as demandas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
