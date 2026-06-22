import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessDemand, canUpdateDemand, canContributeToDemand } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DemandActions } from '@/components/demands/DemandActions'
import { CollaboratorsPanel } from '@/components/demands/CollaboratorsPanel'
import { AcceptancePanel } from '@/components/demands/AcceptancePanel'
import { DemandTimeline } from '@/components/demands/DemandTimeline'
import { DemandEvolutions } from '@/components/demands/DemandEvolutions'
import { DemandQA } from '@/components/demands/DemandQA'
import { DemandChecklist } from '@/components/demands/DemandChecklist'
import {
  ChevronLeft, Clock,
  User, Briefcase, FileText, Calendar, ArrowRightLeft, AlertTriangle, Wrench,
} from 'lucide-react'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'
import { EvidenciasPanel } from '@/components/shared/EvidenciasPanel'
import { DemandDeleteButton } from '@/components/demands/DemandDeleteButton'
import { DeadlineExtensionPanel } from '@/components/demands/DeadlineExtensionPanel'
import { getAusenciasMap } from '@/lib/ausencias'
import { SubstituicaoAlert } from '@/components/shared/SubstituicaoBadge'
import { MarkDemandViewed } from '@/components/demands/MarkDemandViewed'

export default async function DemandDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return null

  const demand = await prisma.demand.findUnique({
    where: { id: params.id },
    include: {
      area:           true,
      project:        { select: { id: true, name: true } },
      requestingArea:  { select: { id: true, name: true } },
      acceptedBy:      { select: { id: true, name: true } },
      rejectedBy:      { select: { id: true, name: true } },
      contract:       { select: { id: true, number: true, name: true } },
      report:         { select: { id: true, title: true } },
      responsible:    { select: { id: true, name: true, role: true } },
      createdBy:      { select: { id: true, name: true } },
      collaborators: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          addedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      deadlineRequests: {
        include: {
          requestedBy: { select: { id: true, name: true } },
          reviewedBy:  { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      updates: {
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true } },
          reactions: { select: { emoji: true, userId: true, user: { select: { name: true } } } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true } } },
          },
        },
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
          mentions: { include: { user: { select: { id: true, name: true } } } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { id: true, name: true } },
              mentions: { include: { user: { select: { id: true, name: true } } } },
            },
          },
        },
      },
      checklistItems: {
        orderBy: { createdAt: 'asc' },
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
  })

  if (!demand) notFound()

  const collaboratorUserIds = demand.collaborators.map((c) => c.user.id)

  if (!canAccessDemand(session, { ...demand, collaboratorUserIds })) notFound()

  const canEdit = canUpdateDemand(session, { ...demand, collaboratorUserIds })
  const canContribute = canContributeToDemand(session, { ...demand, collaboratorUserIds })

  const PRIORITY_LABELS: Record<string, string> = {
    critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa',
  }
  const ORIGIN_LABELS: Record<string, string> = {
    director: 'Diretoria', manager: 'Gerência', report: 'Report',
    contract: 'Contrato', audit: 'Auditoria', interarea: 'Solicitação Interárea', other: 'Outro',
  }

  const isInterArea = Boolean(demand.requestingAreaId)
  const canActOnAcceptancePanel = isInterArea && demand.responsibleId === session.user.id

  // Sinaliza se o responsável está temporariamente ausente (cobertura)
  const ausenciasMap = await getAusenciasMap([demand.responsibleId])
  const ausenciaResp = demand.responsibleId ? ausenciasMap.get(demand.responsibleId) : undefined

  return (
    <div className="max-w-4xl space-y-5">
      <MarkDemandViewed demandId={demand.id} />
      {/* Breadcrumb */}
      <Link href={`/areas/${demand.areaId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
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
            {isInterArea && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                <ArrowRightLeft className="w-3 h-3" />
                INTERÁREA
              </span>
            )}
            <PriorityBadge priority={demand.priority} />
            <StatusBadge status={demand.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{demand.title}</h1>
          {demand.context && (
            <p className="text-sm text-gray-600 mt-1 max-w-2xl whitespace-pre-line">{demand.context}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit && (
            <DemandActions demandId={demand.id} currentStatus={demand.status} session={session} />
          )}
          {['master', 'admin'].includes(session.user.role) && (
            <DemandDeleteButton demandId={demand.id} />
          )}
        </div>
      </div>

      {/* Alerta de substituição temporária do responsável */}
      {ausenciaResp && demand.responsible && (
        <SubstituicaoAlert nome={demand.responsible.name} info={ausenciaResp} />
      )}

      {/* Metadata grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetaItem icon={<User className="w-4 h-4" />} label="Responsável" value={demand.responsible?.name ?? '-'} />
          <MetaItem icon={<Clock className="w-4 h-4" />} label="Prazo" value={demand.dueDate ? formatDate(demand.dueDate) : '—'} highlight={demand.isOverdue} />
          <MetaItem icon={<Calendar className="w-4 h-4" />} label="Prioridade" value={PRIORITY_LABELS[demand.priority] ?? demand.priority} />
          <MetaItem icon={<FileText className="w-4 h-4" />} label="Origem" value={ORIGIN_LABELS[demand.origin] ?? demand.origin} />

          {/* Área Executora */}
          <MetaItem icon={<Briefcase className="w-4 h-4" />} label={isInterArea ? 'Área Executora' : 'Área'} value={demand.area.name} href={`/areas/${demand.areaId}`} />

          {/* Área Solicitante (só em demandas interárea) */}
          {isInterArea && demand.requestingArea && (
            <MetaItem
              icon={<ArrowRightLeft className="w-4 h-4" />}
              label="Área Solicitante"
              value={demand.requestingArea.name}
              href={`/areas/${demand.requestingAreaId}`}
            />
          )}

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
          {demand.project && (
            <div className="col-span-2">
              <MetaItem
                icon={<Briefcase className="w-4 h-4" />}
                label="Projeto"
                value={demand.project.name}
                href={`/projetos/${demand.project.id}`}
              />
            </div>
          )}
          {demand.completedAt && (
            <MetaItem icon={<Clock className="w-4 h-4" />} label="Concluída em" value={formatDate(demand.completedAt)} />
          )}
        </div>
      </div>

      {/* Bloqueios e suporte necessário */}
      {(demand.blockers || demand.supportNeeded) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {demand.blockers && (
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Bloqueios
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{demand.blockers}</p>
            </div>
          )}
          {demand.supportNeeded && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <Wrench className="w-3.5 h-3.5" /> Suporte necessário
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{demand.supportNeeded}</p>
            </div>
          )}
        </div>
      )}

      {/* Prorrogação de prazo */}
      <DeadlineExtensionPanel
        demandId={demand.id}
        currentDueDate={demand.dueDate}
        requests={demand.deadlineRequests.map((r) => ({
          ...r,
          proposedDate: r.proposedDate.toISOString(),
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
        }))}
        canRequest={canContribute && !['completed', 'cancelled'].includes(demand.status)}
        canReview={canEdit}
      />

      {/* Painel de aceite (apenas demandas interárea) */}
      {isInterArea && demand.acceptanceStatus && (
        <AcceptancePanel
          demandId={demand.id}
          acceptanceStatus={demand.acceptanceStatus as any}
          slaStatus={demand.slaStatus as any}
          slaDeadline={demand.slaDeadline}
          acceptedByName={demand.acceptedBy?.name}
          acceptedAt={demand.acceptedAt}
          rejectedByName={demand.rejectedBy?.name}
          rejectedAt={demand.rejectedAt}
          rejectionReason={demand.rejectionReason}
          canActOnBehalf={canActOnAcceptancePanel}
        />
      )}

      {/* Colaboradores */}
      <CollaboratorsPanel
        demandId={demand.id}
        collaborators={demand.collaborators.map((c) => ({ ...c.user, role: c.role as 'contributor' | 'observer' }))}
        canManage={canEdit}
        currentUserId={session.user.id}
      />

      {/* Anexos */}
      <AttachmentsPanel
        initialAttachments={demand.attachments.map((a) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        }))}
        objectType="demand"
        objectId={demand.id}
        canUpload={canContribute}
        currentUserId={canEdit ? session.user.id : ''}
        canDeleteAll={['master', 'admin', 'director'].includes(session.user.role)}
      />

      {/* Evidências vinculadas */}
      <EvidenciasPanel objectType="demand" objectId={demand.id} />

      {/* Checklist de atividades */}
      <DemandChecklist
        demandId={demand.id}
        initialItems={demand.checklistItems.map((i) => ({
          ...i,
          dueDate: i.dueDate ? new Date(i.dueDate) : null,
          completedAt: i.completedAt ? new Date(i.completedAt) : null,
        }))}
        canManage={canEdit}
      />

      {/* Evoluções */}
      <DemandEvolutions
        demandId={demand.id}
        currentUserId={session.user.id}
        initialUpdates={demand.updates.map((u) => ({
          id: u.id,
          content: u.content,
          createdAt: new Date(u.createdAt),
          author: u.author,
          reactions: u.reactions.map((r) => ({ emoji: r.emoji, userId: r.userId, userName: r.user?.name ?? '' })),
          replies: u.replies.map((rp) => ({
            id: rp.id,
            content: rp.content,
            createdAt: new Date(rp.createdAt),
            author: rp.author,
          })),
        }))}
        canAdd={canContribute}
      />

      {/* Perguntas & Respostas */}
      <DemandQA
        demandId={demand.id}
        initialComments={demand.comments.map((c) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          replies: c.replies.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })),
        }))}
        canAdd={canContribute}
      />

      {/* Linha do tempo unificada */}
      <DemandTimeline
        demand={{
          createdAt: demand.createdAt,
          status: demand.status,
          createdBy: demand.createdBy,
          acceptedAt: demand.acceptedAt,
          acceptedBy: demand.acceptedBy,
          rejectedAt: demand.rejectedAt,
          rejectedBy: demand.rejectedBy,
          rejectionReason: demand.rejectionReason,
        }}
        updates={demand.updates.map((u) => ({
          ...u,
          createdAt: new Date(u.createdAt),
        }))}
        comments={demand.comments.map((c) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          replies: c.replies.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })),
        }))}
        collaborators={demand.collaborators.map((c) => ({
          id: c.id,
          createdAt: new Date(c.createdAt),
          role: c.role,
          user: c.user,
          addedBy: c.addedBy,
        }))}
        deadlineRequests={demand.deadlineRequests.map((r) => ({
          ...r,
          proposedDate: r.proposedDate.toISOString(),
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
        }))}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  )
}

function MetaItem({ icon, label, value, href, highlight }: {
  icon: React.ReactNode; label: string; value: string; href?: string; highlight?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">{icon} {label}</p>
      {href ? (
        <Link href={href} className="text-sm font-medium text-blue-600 hover:underline truncate block">{value}</Link>
      ) : (
        <p className={`text-sm font-medium truncate ${highlight ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      )}
    </div>
  )
}
