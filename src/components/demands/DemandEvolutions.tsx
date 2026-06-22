'use client'

import { useState } from 'react'
import { timeAgo } from '@/lib/utils'
import { MessageSquarePlus, SmilePlus, CornerDownRight, Send, Trash2 } from 'lucide-react'

const EMOJIS = ['👍', '❤️', '✅', '🎉', '👀', '❓', '🔥', '👎']

type Reaction = { emoji: string; userId: string; userName: string }
type Reply = { id: string; content: string; createdAt: Date; author: { id?: string; name: string } }
type Update = {
  id: string
  content: string
  createdAt: Date
  author: { id?: string; name: string }
  reactions: Reaction[]
  replies: Reply[]
}

interface Props {
  demandId: string
  currentUserId: string
  initialUpdates: Update[]
  canAdd: boolean
}

export function DemandEvolutions({ demandId, currentUserId, initialUpdates, canAdd }: Props) {
  const [updates, setUpdates] = useState<Update[]>(initialUpdates)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!content.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/demands/${demandId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao registrar'); return }
      setUpdates((prev) => [
        { id: data.data.id, content: data.data.content, createdAt: new Date(), author: { id: currentUserId, name: 'Você' }, reactions: [], replies: [] },
        ...prev,
      ])
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  function patchUpdate(updateId: string, fn: (u: Update) => Update) {
    setUpdates((prev) => prev.map((u) => (u.id === updateId ? fn(u) : u)))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
        <MessageSquarePlus className="w-3.5 h-3.5" />
        Evoluções ({updates.length})
      </h3>

      {canAdd && (
        <div className="mb-5 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Registre um progresso, decisão, bloqueio ou próximo passo…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving || !content.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Enviando…' : 'Registrar evolução'}
            </button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhuma evolução registrada.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-5">
            {updates.map((u) => (
              <EvolutionItem
                key={u.id}
                demandId={demandId}
                currentUserId={currentUserId}
                update={u}
                onPatch={(fn) => patchUpdate(u.id, fn)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EvolutionItem({ demandId, currentUserId, update, onPatch }: {
  demandId: string
  currentUserId: string
  update: Update
  onPatch: (fn: (u: Update) => Update) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Agrupa reações por emoji
  const grupos = EMOJIS
    .map((emoji) => {
      const list = update.reactions.filter((r) => r.emoji === emoji)
      return { emoji, count: list.length, mine: list.some((r) => r.userId === currentUserId), names: list.map((r) => r.userName) }
    })
    .filter((g) => g.count > 0)

  async function toggleReaction(emoji: string) {
    setShowPicker(false)
    // otimista
    onPatch((u) => {
      const mine = u.reactions.some((r) => r.emoji === emoji && r.userId === currentUserId)
      const reactions = mine
        ? u.reactions.filter((r) => !(r.emoji === emoji && r.userId === currentUserId))
        : [...u.reactions, { emoji, userId: currentUserId, userName: 'Você' }]
      return { ...u, reactions }
    })
    try {
      await fetch(`/api/demands/${demandId}/updates/${update.id}/reactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
      })
    } catch { /* mantém otimista */ }
  }

  async function enviarResposta() {
    const txt = replyText.trim()
    if (!txt) return
    setSendingReply(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/updates/${update.id}/replies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: txt }),
      })
      const data = await res.json()
      if (res.ok) {
        onPatch((u) => ({ ...u, replies: [...u.replies, { id: data.data.id, content: txt, createdAt: new Date(), author: { id: currentUserId, name: 'Você' } }] }))
        setReplyText('')
        setReplyOpen(false)
      }
    } finally {
      setSendingReply(false)
    }
  }

  async function removerResposta(replyId: string) {
    onPatch((u) => ({ ...u, replies: u.replies.filter((r) => r.id !== replyId) }))
    try {
      await fetch(`/api/demands/${demandId}/updates/${update.id}/replies`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replyId }),
      })
    } catch { /* ok */ }
  }

  return (
    <div className="relative pl-8">
      <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white bg-blue-400 ring-1 ring-blue-200" />
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-semibold text-gray-700">{update.author.name}</span>
        <span className="text-xs text-gray-400">{timeAgo(update.createdAt)}</span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-line">{update.content}</p>

      {/* Reações + ações */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {grupos.map((g) => (
          <button
            key={g.emoji}
            onClick={() => toggleReaction(g.emoji)}
            title={g.names.join(', ')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-colors ${
              g.mine ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{g.emoji}</span><span className="font-medium">{g.count}</span>
          </button>
        ))}

        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            title="Reagir"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
          {showPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
              <div className="absolute left-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => toggleReaction(e)} className="w-7 h-7 rounded-lg hover:bg-gray-100 text-base leading-none">
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setReplyOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded-lg"
        >
          <CornerDownRight className="w-3.5 h-3.5" /> Questionar / responder
        </button>
      </div>

      {/* Respostas (curtas) */}
      {update.replies.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-gray-100 pl-3">
          {update.replies.map((r) => {
            const podeRemover = r.author.id === currentUserId
            return (
              <div key={r.id} className="group flex items-start gap-2 text-sm">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-gray-600">{r.author.name}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{timeAgo(r.createdAt)}</span>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{r.content}</p>
                </div>
                {podeRemover && (
                  <button onClick={() => removerResposta(r.id)} title="Remover" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity mt-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {replyOpen && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escreva um questionamento ou resposta curta…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            onKeyDown={(e) => { if (e.key === 'Enter' && replyText.trim()) enviarResposta() }}
          />
          <button
            onClick={enviarResposta}
            disabled={sendingReply || !replyText.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
