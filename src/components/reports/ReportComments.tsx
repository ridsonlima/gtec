'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, ChevronDown, ChevronUp, AlertCircle, FileText, Eye } from 'lucide-react'
import { timeAgo, cn } from '@/lib/utils'
import type { Session } from 'next-auth'

type CommentType = 'observation' | 'clarification' | 'follow_up' | 'evidence_request'

interface EvidenceRequest {
  id: string
  status: string
  description: string
  dueDate: string | null
  responsible: { id: string; name: string }
}

interface Comment {
  id: string
  type: CommentType
  content: string
  createdAt: string
  author: { id: string; name: string; role: string }
  replies: Comment[]
  evidenceRequest: EvidenceRequest | null
}

const TYPE_LABELS: Record<CommentType, { label: string; color: string }> = {
  observation:      { label: 'Observação',          color: 'bg-gray-100 text-gray-600' },
  clarification:    { label: 'Solicitação',          color: 'bg-blue-50 text-blue-700' },
  follow_up:        { label: 'Acompanhamento',       color: 'bg-purple-50 text-purple-700' },
  evidence_request: { label: 'Pedido de Evidência',  color: 'bg-amber-50 text-amber-700' },
}

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  pending:  '⏳ Pendente',
  received: '✅ Recebida',
  rejected: '❌ Rejeitada',
}

interface ReportCommentsProps {
  reportId: string
  areaId: string
  session: Session
}

export function ReportComments({ reportId, areaId, session }: ReportCommentsProps) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<CommentType>('observation')
  const [content, setContent] = useState('')
  const [evidenceDesc, setEvidenceDesc] = useState('')
  const [evidenceDate, setEvidenceDate] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['comments', 'report', reportId],
    queryFn: () =>
      fetch(`/api/comments?objectType=report&objectId=${reportId}`)
        .then((r) => r.json()),
  })

  const comments: Comment[] = data?.data ?? []

  const postMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar')
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', 'report', reportId] })
      setContent('')
      setEvidenceDesc('')
      setEvidenceDate('')
      setType('observation')
      setShowForm(false)
      setReplyTo(null)
      setReplyContent('')
      setError('')
    },
    onError: (e: any) => setError(e.message),
  })

  const handleSubmit = () => {
    if (!content.trim()) { setError('Escreva o comentário'); return }
    const payload: Record<string, unknown> = {
      objectType: 'report',
      objectId: reportId,
      type,
      content,
    }
    if (type === 'evidence_request') {
      if (!evidenceDesc.trim()) { setError('Descreva a evidência solicitada'); return }
      payload.evidenceDescription = evidenceDesc
      if (evidenceDate) payload.evidenceDueDate = evidenceDate
    }
    postMutation.mutate(payload)
  }

  const handleReply = (parentId: string) => {
    if (!replyContent.trim()) { setError('Escreva a resposta'); return }
    postMutation.mutate({
      objectType: 'report',
      objectId: reportId,
      type: 'observation',
      content: replyContent,
      parentId,
    })
  }

  const toggleReplies = (id: string) =>
    setExpandedReplies((prev) => ({ ...prev, [id]: !prev[id] }))

  const isDirector = session.user.role === 'director' || session.user.role === 'admin'

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        Carregando interações...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Lista de comentários */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">
          Nenhuma interação ainda. Seja o primeiro a comentar.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              isOwn={c.author.id === session.user.id}
              replyTo={replyTo}
              replyContent={replyContent}
              expandedReplies={expandedReplies}
              isPending={postMutation.isPending}
              onReplyToggle={(id) => {
                setReplyTo(replyTo === id ? null : id)
                setReplyContent('')
                setError('')
              }}
              onReplyChange={setReplyContent}
              onReplySubmit={handleReply}
              onToggleReplies={toggleReplies}
            />
          ))}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Formulário novo comentário */}
      {showForm ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TYPE_LABELS) as [CommentType, { label: string; color: string }][])
              .filter(([t]) => t !== 'evidence_request' || isDirector)
              .map(([t, { label, color }]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    type === t
                      ? `${color} border-current ring-1 ring-current`
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
          </div>

          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              type === 'evidence_request'
                ? 'Descreva o que está solicitando como comentário/contexto...'
                : 'Escreva seu comentário...'
            }
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {type === 'evidence_request' && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Detalhes da evidência solicitada
              </p>
              <textarea
                rows={2}
                value={evidenceDesc}
                onChange={(e) => setEvidenceDesc(e.target.value)}
                placeholder="Descreva exatamente o que deve ser enviado (ex: foto do avanço físico, planilha de medição...)"
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm resize-none
                           focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
              <div>
                <label className="text-xs text-amber-700 font-medium">Prazo (opcional)</label>
                <input
                  type="date"
                  value={evidenceDate}
                  onChange={(e) => setEvidenceDate(e.target.value)}
                  className="mt-1 block w-full sm:w-48 px-3 py-1.5 border border-amber-200 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { setShowForm(false); setContent(''); setError('') }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={postMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white
                         text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {postMutation.isPending
                ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                : <Send className="w-3.5 h-3.5" />}
              Enviar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300
                     text-sm text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Adicionar interação
        </button>
      )}
    </div>
  )
}

// ─── CommentCard ───────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  isOwn,
  replyTo,
  replyContent,
  expandedReplies,
  isPending,
  onReplyToggle,
  onReplyChange,
  onReplySubmit,
  onToggleReplies,
}: {
  comment: Comment
  isOwn: boolean
  replyTo: string | null
  replyContent: string
  expandedReplies: Record<string, boolean>
  isPending: boolean
  onReplyToggle: (id: string) => void
  onReplyChange: (v: string) => void
  onReplySubmit: (parentId: string) => void
  onToggleReplies: (id: string) => void
}) {
  const meta = TYPE_LABELS[comment.type] ?? TYPE_LABELS.observation
  const isReplying = replyTo === comment.id
  const hasReplies = comment.replies.length > 0
  const repliesExpanded = !!expandedReplies[comment.id]

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden',
      comment.type === 'evidence_request'
        ? 'border-amber-200 bg-amber-50/30'
        : comment.type === 'clarification'
        ? 'border-blue-100 bg-blue-50/20'
        : 'border-gray-100 bg-white'
    )}>
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', meta.color)}>
              {meta.label}
            </span>
            <span className="text-xs font-medium text-gray-700">{comment.author.name}</span>
            <span className="text-xs text-gray-400">{timeAgo(new Date(comment.createdAt))}</span>
            {isOwn && (
              <span className="text-xs text-gray-400 italic">você</span>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
          {comment.content}
        </p>

        {/* Evidence request detail */}
        {comment.evidenceRequest && (
          <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Evidência solicitada</span>
              <span className={cn(
                'ml-auto text-xs px-2 py-0.5 rounded-full font-medium',
                comment.evidenceRequest.status === 'received'
                  ? 'bg-green-100 text-green-700'
                  : comment.evidenceRequest.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              )}>
                {EVIDENCE_STATUS_LABELS[comment.evidenceRequest.status] ?? comment.evidenceRequest.status}
              </span>
            </div>
            <p className="text-xs text-amber-800">{comment.evidenceRequest.description}</p>
            <p className="text-xs text-amber-600">
              Responsável: {comment.evidenceRequest.responsible.name}
              {comment.evidenceRequest.dueDate && (
                <> · Prazo: {new Date(comment.evidenceRequest.dueDate).toLocaleDateString('pt-BR')}</>
              )}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => onReplyToggle(comment.id)}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            {isReplying ? 'Cancelar resposta' : 'Responder'}
          </button>
          {hasReplies && (
            <button
              onClick={() => onToggleReplies(comment.id)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            >
              {repliesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {comment.replies.length} resposta{comment.replies.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-3 flex gap-2">
            <textarea
              rows={2}
              value={replyContent}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder="Escreva sua resposta..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => onReplySubmit(comment.id)}
              disabled={isPending}
              className="self-end px-3 py-2 bg-blue-600 text-white text-sm rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full block" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {hasReplies && repliesExpanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50 bg-gray-50/40">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="px-4 py-3 pl-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">{reply.author.name}</span>
                <span className="text-xs text-gray-400">{timeAgo(new Date(reply.createdAt))}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
