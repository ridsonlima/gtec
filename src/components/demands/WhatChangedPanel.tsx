import { Sparkles, ArrowRight, MessageSquare, Paperclip, Pencil } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

export type ChangeItem = {
  kind: 'status' | 'update' | 'comment' | 'attachment'
  text: string
  author?: string
  at: Date | string
}

const ICONS = {
  status: ArrowRight,
  update: Pencil,
  comment: MessageSquare,
  attachment: Paperclip,
} as const

/**
 * Bloco "O que mudou desde sua última visita" — resume as novidades (mudanças de
 * status, evoluções, comentários e anexos) ocorridas após o último viewedAt do
 * usuário. Server component puro.
 */
export function WhatChangedPanel({ items }: { items: ChangeItem[] }) {
  if (!items.length) return null

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        O que mudou desde sua última visita
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => {
          const Icon = ICONS[it.kind]
          return (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <Icon className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
              <span className="min-w-0">
                {it.text}
                {it.author && <span className="text-gray-400"> · {it.author}</span>}
                <span className="text-gray-400"> · {timeAgo(it.at)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
