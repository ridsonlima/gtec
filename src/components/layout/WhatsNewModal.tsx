'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

type Novidade = {
  id: string
  title: string
  body: string
  createdAt: string
  author?: { name: string } | null
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Modal "O que há de novo" — exibido ao logar quando há novidades do sistema
 *  (Comunicado categoria='novidade') que o usuário ainda não leu. */
export function WhatsNewModal() {
  const [items, setItems] = useState<Novidade[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/comunicados/novidades')
      .then((r) => r.json())
      .then((res) => {
        const list: Novidade[] = res?.data ?? []
        if (list.length) {
          setItems(list)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  async function dismiss() {
    setSaving(true)
    await Promise.all(
      items.map((n) => fetch(`/api/comunicados/${n.id}/lido`, { method: 'POST' }).catch(() => {}))
    )
    setOpen(false)
  }

  if (!open || items.length === 0) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-blue-50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">O que há de novo no GTec</h2>
              <p className="text-xs text-gray-500">
                {items.length === 1 ? '1 novidade' : `${items.length} novidades`} desde sua última visita
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {items.map((n) => (
            <div key={n.id} className="border-l-2 border-blue-200 pl-3">
              <p className="text-sm font-semibold text-gray-900">{n.title}</p>
              <p className="text-xs text-gray-400 mb-1.5">
                {fmt(n.createdAt)}{n.author?.name ? ` · ${n.author.name}` : ''}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{n.body}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={dismiss}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Entendi'}
          </button>
        </div>
      </div>
    </div>
  )
}
