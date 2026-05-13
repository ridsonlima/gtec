import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, formatDateTime, formatFileSize, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { DemandActions } from '@/components/demands/DemandActions'
import { DemandUpdateActions } from '@/components/demands/DemandUpdateActions'
import {
  ChevronLeft, Paperclip, MessageSquare, Clock,
  User, Briefcase, FileText, Calendar,
} from 'lucide-react'

export default async function DemandDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) return null

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: {
      area:        true,
      contract:    { select: { id: true, number: true, name: true } },
      report:      { select: { id: true, title: true } },
      responsible: { select: { id: true, name: true, role: true } },
      createdBy:   { select: { id: true, name: true } },
      updates: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  if (!demand) notFound()
  if (!canAccessArea(session, demand.areaId)) notFound()

  const canEdit =
    session.user.role === 'master' ||
    session.user.role === 'admin' ||
    session.user.role === 'director' ||
    demand.responsibleId === session.user.id

  const PRIORITY_LABELS: Record<string, string> = {
    critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa',
  }
  const ORIGIN_LABELS: Record<string, string> = {
    director: 'Diretoria', manager: 'Gerência', report: 'Report',
    contract: 'Contrato', audit: 'Auditoria', other: 'Outro',
  }

  const icons: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'IMG',
    'image/png': 'IMG',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLS',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOC',
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Breadcrumb */}
      <Link
        href={`/areas/${demand.areaId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
      >
        <ChevronLeft className="w-4 h-4" />
        Demandas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {demand.isOverdue && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                VENCIDA
              </span>
            )}
            <PriorityBadge priority={demand.priority} />
            <StatusBadge status={demand.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{demand.title}</h1>
          {demand.context && (
            <p className="text-sm text-gray-600 mt-1 max-w-2xl whitespace-pre-line">
              {demand.context}
            </p>
          )}
        </div>
        {canEdit && (
          <DemandActions demandId={demand.id} currentStatus={demand.status} session={session} />
        )}
      </div>

      {/* Metadata grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetaItem icon={<User className="w-4 h-4" />} label="Responsável" value={demand.responsible?.name ?? '-'} />
          <MetaItem icon={<Clock className="w-4 h-4" />} label="Prazo" value={demand.dueDate ? formatDate(demand.dueDate) : '—'} highlight={demand.isOverdue} />
          <MetaItem icon={<Calendar className="w-4 h-4" />} label="Prioridade" value={PRIORITY_LABELS[demand.priority] ?? demand.priority} />
          <MetaItem icon={<FileText className="w-4 h-4" />} label="Origem" value={ORIGIN_LABELS[demand.origin] ?? demand.origin} />
          {demand.contract && (
            <div className="col-span-2">
              <MetaItem
                icon={<Briefcase className="w-4 h-4" />}
                label="Contrato"
                value={`${demand.contract.number} — ${demand.contract.name}`}
                href={`/contratos/${demand.contract.id}`}
              />
            </div>
          )}
          {demand.report && (
            <div className="col-span-2">
              <MetaItem
                icon={<FileText className="w-4 h-4" />}
                label="Report de origem"
                value={demand.report.title}
                href={`/reports/${demand.report.id}`}
              />
            </div>
          )}
          {demand.completedAt && (
            <MetaItem icon={<Clock className="w-4 h-4" />} label="Concluída em" value={formatDate(demand.completedAt)} />
          )}
        </div>
      </div>

      {/* Updates timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Histórico de Atualizações
        </h3>

        {demand.updates.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma atualização registrada.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-4">
              {demand.updates.map((u, i) => (
                <div key={u.id} className="relative flex gap-4 pl-8">
                  <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white
                                  bg-gray-300 ring-1 ring-gray-200" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium text-gray-700">{u.author.name}</span>
                      {u.statusAfter && (
                        <span className="text-xs text-gray-400">
                          → <StatusBadge status={u.statusAfter} />
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(new Date(u.createdAt))}</span>
                    </div>
                    {u.content && (
                      <p className="text-sm text-gray-700 whitespace-pre-line">{u.content}</p>
                    )}
                    {(u.author.id === session.user.id && !['completed', 'cancelled'].includes(demand.status)) || ['master', 'admin', 'director'].includes(session.user.role) ? (
                      <DemandUpdateActions updateId={u.id} initialContent={u.content ?? ''} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attachments */}
      {demand.attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" />
            Anexos ({demand.attachments.length})
          </h3>
          <div className="space-y-2">
            {demand.attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-lg">{icons[att.mimeType] ?? '📎'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 truncate">{att.originalName}</p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(att.sizeBytes)} · {att.uploadedBy.name} · {timeAgo(new Date(att.createdAt))}
                  </p>
                </div>
                <a
                  href={`/api/attachments/${att.id}/url`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex-shrink-0"
                >
                  Baixar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {demand.comments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comentários ({demand.comments.length})
          </h3>
          <div className="space-y-3">
            {demand.comments.map((c) => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-700">{c.author.name}</span>
                  <span className="text-xs text-gray-400">{timeAgo(new Date(c.createdAt))}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{c.content}</p>
                {c.replies.length > 0 && (
                  <div className="mt-3 ml-4 border-l-2 border-gray-100 pl-3 space-y-2">
                    {c.replies.map((r) => (
                      <div key={r.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-600">{r.author.name}</span>
                          <span className="text-xs text-gray-400">{timeAgo(new Date(r.createdAt))}</span>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-line">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetaItem({
  icon, label, value, href, highlight,
}: {
  icon: React.ReactNode; label: string; value: string; href?: string; highlight?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
        {icon} {label}
      </p>
      {href ? (
        <Link href={href} className="text-sm font-medium text-blue-600 hover:underline truncate block">
          {value}
        </Link>
      ) : (
        <p className={`text-sm font-medium truncate ${highlight ? 'text-red-600' : 'text-gray-800'}`}>
          {value}
        </p>
      )}
    </div>
  )
}
