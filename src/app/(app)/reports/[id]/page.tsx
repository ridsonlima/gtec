import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea } from '@/lib/permissions'
import Link from 'next/link'
import { formatDateTime, formatFileSize, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ReportComments } from '@/components/reports/ReportComments'
import { ChevronLeft, FileText, Paperclip, MessageSquare, Plus, Calendar } from 'lucide-react'

export default async function ReportDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) return null

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    include: {
      area: true,
      contract: { select: { id: true, number: true, name: true } },
      author: { select: { id: true, name: true, role: true } },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      _count: { select: { versions: true, demands: true } },
    },
  })

  if (!report) notFound()
  if (!canAccessArea(session, report.areaId)) notFound()

  const isDraft = report.status === 'draft'
  const isAuthor = report.authorId === session.user.id
  const canEdit = ['master', 'admin'].includes(session.user.role) || isAuthor
  const canPublish = (session.user.role === 'manager' && isAuthor) || ['master', 'admin'].includes(session.user.role)
  const isDirector = ['master', 'director', 'admin'].includes(session.user.role)

  const sections: Array<{
    key: string
    label: string
    icon: string | null
    highlight?: string | null
  }> = [
    { key: 'executiveSummary', label: 'Resumo Executivo', icon: null },
    { key: 'evolutions', label: 'EvoluÃ§Ãµes', icon: null },
    { key: 'criticalPoints', label: 'Pontos CrÃ­ticos', icon: 'ðŸ”´', highlight: 'red' },
    { key: 'attentionPoints', label: 'Pontos de AtenÃ§Ã£o', icon: 'ðŸŸ¡', highlight: 'amber' },
    { key: 'risks', label: 'Riscos', icon: 'â›”', highlight: null },
    { key: 'blockers', label: 'Bloqueios', icon: 'ðŸš§', highlight: null },
    { key: 'decisionsNeeded', label: 'DecisÃµes NecessÃ¡rias', icon: 'âš¡', highlight: 'blue' },
    { key: 'nextSteps', label: 'PrÃ³ximos Passos', icon: null },
    { key: 'pendingItems', label: 'PendÃªncias', icon: 'ðŸ“‹' },
    { key: 'agendaSuggestion', label: 'SugestÃ£o de Pauta', icon: 'ðŸ“…' },
  ]

  const highlightClasses: Record<string, string> = {
    red: 'border-red-100 bg-red-50/40',
    amber: 'border-amber-100 bg-amber-50/40',
    blue: 'border-blue-100 bg-blue-50/40',
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href={`/areas/${report.areaId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          {report.area.name}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={report.status} />
              {report.hasCritical && (
                <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  ðŸ”´ Ponto crÃ­tico
                </span>
              )}
              {report.hasDecisionNeeded && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  âš¡ DecisÃ£o necessÃ¡ria
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Por {report.author.name}
              {report.publishedAt
                ? ` Â· Publicado ${formatDateTime(report.publishedAt)}`
                : ` Â· Criado ${timeAgo(report.createdAt)}`}
              {report.contract && (
                <span className="ml-2 text-gray-400">
                  Â· <Link href={`/contratos/${report.contract.id}`} className="hover:text-blue-600">
                    {report.contract.number}
                  </Link>
                </span>
              )}
            </p>
          </div>

          {/* AÃ§Ãµes */}
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {canEdit && report.status !== 'archived' && (
              <Link
                href={`/reports/${report.id}/editar`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Editar
              </Link>
            )}
            {isDirector && (
              <>
                <Link
                  href={`/demandas/nova?reportId=${report.id}&areaId=${report.areaId}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar Demanda
                </Link>
                <Link
                  href={`/pauta/nova?reportId=${report.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Adicionar Ã  Pauta
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SeÃ§Ãµes do conteÃºdo */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {sections.map(({ key, label, icon, highlight }) => {
          const value = (report as any)[key] as string | null
          if (!value?.trim()) return null
          return (
            <div
              key={key}
              className={`px-6 py-4 ${highlight ? highlightClasses[highlight] : ''}`}
            >
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {icon && <span className="mr-1.5">{icon}</span>}
                {label}
              </h3>
              <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {value}
              </div>
            </div>
          )
        })}

        {/* Mensagem se report vazio */}
        {sections.every(({ key }) => !(report as any)[key]?.trim()) && (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            Report sem conteÃºdo ainda.
            {canEdit && (
              <Link href={`/reports/${report.id}/editar`} className="ml-2 text-blue-600 hover:underline">
                Preencher
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Anexos */}
      {report.attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" />
            Anexos ({report.attachments.length})
          </h3>
          <div className="space-y-2">
            {report.attachments.map((att) => (
              <AttachmentRow key={att.id} attachment={att} />
            ))}
          </div>
        </div>
      )}

      {/* InteraÃ§Ãµes / comentÃ¡rios */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          InteraÃ§Ãµes
        </h3>
        <ReportComments
          reportId={report.id}
          areaId={report.areaId}
          session={session}
        />
      </div>

      {/* HistÃ³rico de versÃµes */}
      {report._count.versions > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            HistÃ³rico de VersÃµes ({report._count.versions})
          </h3>
          <Link
            href={`/reports/${report.id}/versoes`}
            className="text-sm text-blue-600 hover:underline"
          >
            Ver versÃµes anteriores â†’
          </Link>
        </div>
      )}
    </div>
  )
}

function AttachmentRow({ attachment }: { attachment: any }) {
  const icons: Record<string, string> = {
    'application/pdf': 'ðŸ“„',
    'image/jpeg': 'ðŸ–¼',
    'image/png': 'ðŸ–¼',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'ðŸ“Š',
    'application/vnd.ms-excel': 'ðŸ“Š',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'ðŸ“',
  }
  const icon = icons[attachment.mimeType] ?? 'ðŸ“Ž'

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-700 truncate">{attachment.originalName}</p>
        <p className="text-xs text-gray-400">
          {formatFileSize(attachment.sizeBytes)} Â· {attachment.uploadedBy.name} Â· {timeAgo(attachment.createdAt)}
        </p>
      </div>
      <a
        href={`/api/attachments/${attachment.id}/url`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline flex-shrink-0"
      >
        Baixar
      </a>
    </div>
  )
}

