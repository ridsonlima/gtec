import { timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DemandUpdateActions } from './DemandUpdateActions'
import {
  Plus, Edit2, UserPlus, CheckCircle, XCircle, MessageSquare,
  AlertCircle, Eye, AtSign,
} from 'lucide-react'

const COMMENT_TYPE_META: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  observation:      { label: 'Observação',         dotClass: 'bg-gray-300',   badgeClass: 'bg-gray-100 text-gray-600' },
  clarification:    { label: 'Solicitação',         dotClass: 'bg-blue-400',   badgeClass: 'bg-blue-50 text-blue-700' },
  follow_up:        { label: 'Cobrança',            dotClass: 'bg-purple-400', badgeClass: 'bg-purple-50 text-purple-700' },
  evidence_request: { label: 'Pedido de Evidência', dotClass: 'bg-amber-400',  badgeClass: 'bg-amber-50 text-amber-700' },
}

type TUpdate = {
  id: string
  content: string | null
  statusBefore: string | null
  statusAfter: string | null
  createdAt: Date
  author: { id: string; name: string }
}

type TComment = {
  id: string
  content: string
  type: string
  isResolved: boolean
  createdAt: Date
  author: { id: string; name: string }
  mentions: { user: { id: string; name: string } }[]
  replies: {
    id: string
    content: string
    createdAt: Date
    author: { id: string; name: string }
    mentions: { user: { id: string; name: string } }[]
  }[]
}

type TCollaborator = {
  id: string
  createdAt: Date
  role: string
  user: { id: string; name: string }
  addedBy: { name: string } | null
}

interface Props {
  demand: {
    createdAt: Date
    status: string
    createdBy: { id: string; name: string }
    acceptedAt?: Date | null
    acceptedBy?: { id: string; name: string } | null
    rejectedAt?: Date | null
    rejectedBy?: { id: string; name: string } | null
    rejectionReason?: string | null
  }
  updates: TUpdate[]
  comments: TComment[]
  collaborators: TCollaborator[]
  currentUserId: string
  currentUserRole: string
}

type TimelineEvent =
  | { kind: 'created'; date: Date; authorName: string }
  | { kind: 'update'; id: string; date: Date; authorId: string; authorName: string; content: string | null; statusBefore: string | null; statusAfter: string | null }
  | { kind: 'collaborator'; id: string; date: Date; addedByName: string; userName: string; role: string }
  | { kind: 'accepted'; date: Date; authorName: string }
  | { kind: 'rejected'; date: Date; authorName: string; reason: string | null }
  | { kind: 'comment'; id: string; date: Date; comment: TComment }

export function DemandTimeline({
  demand, updates, comments, collaborators, currentUserId, currentUserRole,
}: Props) {
  const events: TimelineEvent[] = []

  events.push({ kind: 'created', date: demand.createdAt, authorName: demand.createdBy.name })

  for (const u of updates) {
    events.push({
      kind: 'update',
      id: u.id,
      date: u.createdAt,
      authorId: u.author.id,
      authorName: u.author.name,
      content: u.content,
      statusBefore: u.statusBefore,
      statusAfter: u.statusAfter,
    })
  }

  for (const c of collaborators) {
    events.push({
      kind: 'collaborator',
      id: c.id,
      date: c.createdAt,
      addedByName: c.addedBy?.name ?? '—',
      userName: c.user.name,
      role: c.role,
    })
  }

  if (demand.acceptedAt && demand.acceptedBy) {
    events.push({ kind: 'accepted', date: demand.acceptedAt, authorName: demand.acceptedBy.name })
  }
  if (demand.rejectedAt && demand.rejectedBy) {
    events.push({ kind: 'rejected', date: demand.rejectedAt, authorName: demand.rejectedBy.name, reason: demand.rejectionReason ?? null })
  }

  for (const c of comments) {
    events.push({ kind: 'comment', id: c.id, date: c.createdAt, comment: c })
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime())

  const canEditUpdate = (authorId: string) =>
    (authorId === currentUserId && !['completed', 'cancelled'].includes(demand.status)) ||
    ['master', 'admin', 'director'].includes(currentUserRole)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Linha do Tempo
      </h3>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum evento registrado.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-4">
            {events.map((event, idx) => {
              if (event.kind === 'created') {
                return (
                  <div key={`created-${idx}`} className="relative flex gap-4 pl-8">
                    <div className="absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-blue-400 ring-1 ring-blue-200 flex items-center justify-center">
                      <Plus className="w-2 h-2 text-white" />
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{event.authorName}</span>
                      {' '}criou esta demanda{' '}
                      <span className="text-gray-400">{timeAgo(event.date)}</span>
                    </p>
                  </div>
                )
              }

              if (event.kind === 'update') {
                return (
                  <div key={`update-${event.id}`} className="relative flex gap-4 pl-8">
                    <div className="absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-gray-300 ring-1 ring-gray-200 flex items-center justify-center">
                      <Edit2 className="w-2 h-2 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium text-gray-700">{event.authorName}</span>
                        {event.statusAfter && (
                          <span className="text-xs text-gray-400">
                            → <StatusBadge status={event.statusAfter} />
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{timeAgo(event.date)}</span>
                      </div>
                      {event.content && (
                        <p className="text-sm text-gray-700 whitespace-pre-line">{event.content}</p>
                      )}
                      {canEditUpdate(event.authorId) && (
                        <DemandUpdateActions updateId={event.id} initialContent={event.content ?? ''} />
                      )}
                    </div>
                  </div>
                )
              }

              if (event.kind === 'collaborator') {
                return (
                  <div key={`collab-${event.id}`} className="relative flex gap-4 pl-8">
                    <div className="absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-indigo-300 ring-1 ring-indigo-200 flex items-center justify-center">
                      <UserPlus className="w-2 h-2 text-indigo-700" />
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{event.addedByName}</span>
                      {' '}adicionou{' '}
                      <span className="font-medium text-gray-700">{event.userName}</span>
                      {' '}como {event.role === 'contributor' ? 'colaborador' : 'observador'}{' '}
                      <span className="text-gray-400">{timeAgo(event.date)}</span>
                    </p>
                  </div>
                )
              }

              if (event.kind === 'accepted') {
                return (
                  <div key={`accepted-${idx}`} className="relative flex gap-4 pl-8">
                    <div className="absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-green-400 ring-1 ring-green-200 flex items-center justify-center">
                      <CheckCircle className="w-2 h-2 text-white" />
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-green-700">{event.authorName}</span>
                      {' '}aceitou a solicitação interárea{' '}
                      <span className="text-gray-400">{timeAgo(event.date)}</span>
                    </p>
                  </div>
                )
              }

              if (event.kind === 'rejected') {
                return (
                  <div key={`rejected-${idx}`} className="relative flex gap-4 pl-8">
                    <div className="absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-red-400 ring-1 ring-red-200 flex items-center justify-center">
                      <XCircle className="w-2 h-2 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-red-700">{event.authorName}</span>
                        {' '}rejeitou a solicitação interárea{' '}
                        <span className="text-gray-400">{timeAgo(event.date)}</span>
                      </p>
                      {event.reason && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">"{event.reason}"</p>
                      )}
                    </div>
                  </div>
                )
              }

              if (event.kind === 'comment') {
                const c = event.comment
                const meta = COMMENT_TYPE_META[c.type] ?? COMMENT_TYPE_META.observation
                const isMentioned = c.mentions.some((m) => m.user.id === currentUserId)

                return (
                  <div key={`comment-${event.id}`} className="relative flex gap-4 pl-8">
                    <div className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-white ${meta.dotClass} ring-1 ring-gray-200`} />
                    <div className={`flex-1 min-w-0 border rounded-lg p-3 ${isMentioned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                        {isMentioned && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            <AtSign className="w-2.5 h-2.5" />
                            você
                          </span>
                        )}
                        {c.isResolved && (
                          <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            Resolvido
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-700">{c.author.name}</span>
                        <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{c.content}</p>
                      {c.mentions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {c.mentions.map((m) => (
                            <span key={m.user.id} className="text-xs text-blue-600">@{m.user.name}</span>
                          ))}
                        </div>
                      )}
                      {c.replies.length > 0 && (
                        <div className="mt-2 ml-2 border-l-2 border-gray-200 pl-3 space-y-2">
                          {c.replies.map((r) => (
                            <div key={r.id}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium text-gray-600">{r.author.name}</span>
                                <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                              </div>
                              <p className="text-sm text-gray-600 whitespace-pre-line">{r.content}</p>
                              {r.mentions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {r.mentions.map((m) => (
                                    <span key={m.user.id} className="text-xs text-blue-600">@{m.user.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return null
            })}
          </div>
        </div>
      )}
    </div>
  )
}
