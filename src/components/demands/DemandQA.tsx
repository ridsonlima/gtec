'use client'

import { useState } from 'react'
import { timeAgo } from '@/lib/utils'
import { MessageCircle, Reply, CheckCircle2 } from 'lucide-react'

type Comment = {
  id: string
  content: string
  type: string
  isResolved: boolean
  createdAt: Date
  author: { id: string; name: string }
  replies: { id: string; content: string; createdAt: Date; author: { name: string } }[]
}

interface Props {
  demandId: string
  initialComments: Comment[]
  canAdd: boolean
}

const TYPE_OPTIONS = [
  { value: 'clarification', label: 'Pergunta / Solicitação de esclarecimento' },
  { value: 'follow_up', label: 'Cobrança / Follow-up' },
  { value: 'observation', label: 'Observação geral' },
]

const TYPE_COLORS: Record<string, string> = {
  clarification: 'text-blue-700 bg-blue-50 border-blue-200',
  follow_up: 'text-purple-700 bg-purple-50 border-purple-200',
  observation: 'text-gray-600 bg-gray-100 border-gray-200',
}

const TYPE_LABELS: Record<string, string> = {
  clarification: 'Pergunta',
  follow_up: 'Cobrança',
  observation: 'Observação',
  evidence_request: 'Evidência',
}

export function DemandQA({ demandId, initialComments, canAdd }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [type, setType] = useState('clarification')
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submitComment() {
    if (!content.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType: 'demand', objectId: demandId, type, content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar'); return }
      setComments((prev) => [...prev, { ...data.data, createdAt: new Date(), replies: [] }])
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  async function submitReply(parentId: string) {
    if (!replyContent.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType: 'demand', objectId: demandId, type: 'observation', content: replyContent.trim(), parentId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao responder'); return }
      setComments((prev) => prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...c.replies, { id: data.data.id, content: replyContent.trim(), createdAt: new Date(), author: { name: 'Você' } }] }
          : c
      ))
      setReplyContent('')
      setReplyTo(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
        <MessageCircle className="w-3.5 h-3.5" />
        Perguntas & Respostas ({comments.length})
      </h3>

      {canAdd && (
        <div className="mb-5 space-y-2 pb-5 border-b border-gray-100">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva sua pergunta, cobrança ou observação…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={submitComment}
              disabled={saving || !content.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nenhuma pergunta ou observação ainda.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[c.type] ?? TYPE_COLORS.observation}`}>
                  {TYPE_LABELS[c.type] ?? c.type}
                </span>
                {c.isResolved && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                    <CheckCircle2 className="w-3 h-3" /> Resolvido
                  </span>
                )}
                <span className="text-xs font-semibold text-gray-700">{c.author.name}</span>
                <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">{c.content}</p>

              {/* Respostas */}
              {c.replies.length > 0 && (
                <div className="mt-3 ml-3 border-l-2 border-gray-200 pl-3 space-y-2">
                  {c.replies.map((r) => (
                    <div key={r.id}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-600">{r.author.name}</span>
                        <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Form de resposta */}
              {canAdd && replyTo === c.id ? (
                <div className="mt-3 ml-3 space-y-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Escreva sua resposta…"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setReplyTo(null); setReplyContent('') }} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button
                      onClick={() => submitReply(c.id)}
                      disabled={saving || !replyContent.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Responder
                    </button>
                  </div>
                </div>
              ) : canAdd && (
                <button
                  onClick={() => { setReplyTo(c.id); setReplyContent('') }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
                >
                  <Reply className="w-3 h-3" /> Responder
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
