import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector, isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { MilestoneList } from '@/components/projects/MilestoneList'
import { ProjectUpdateForm } from '@/components/projects/ProjectUpdateForm'
import { ChevronLeft, Briefcase, Calendar, User, AlertTriangle, Edit2 } from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  planned:     { label: 'Planejado',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'Em andamento', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed:   { label: 'Concluído',    cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:   { label: 'Cancelado',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const RISK_META: Record<string, { label: string; cls: string }> = {
  low:      { label: 'Risco Baixo',    cls: 'bg-green-50 text-green-700' },
  medium:   { label: 'Risco Médio',    cls: 'bg-amber-50 text-amber-700' },
  high:     { label: 'Risco Alto',     cls: 'bg-orange-50 text-orange-700' },
  critical: { label: 'Risco Crítico',  cls: 'bg-red-50 text-red-700' },
}

export default async function ProjetoDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      responsibleUser: { select: { id: true, name: true } },
      milestones: { orderBy: { dueDate: 'asc' } },
      updates: {
        orderBy: { createdAt: 'desc' },
        include: { project: { select: { id: true } } },
      },
      demands: {
        where: { status: { notIn: ['completed', 'cancelled'] } },
        orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
        take: 10,
        include: {
          area:        { select: { name: true } },
          responsible: { select: { name: true } },
        },
      },
    },
  })

  if (!project) notFound()

  const dir       = isDirector(session.user.role)
  const canManage = dir || session.user.id === project.responsibleId

  // Buscar nomes dos autores das atualizações
  const allAuthorIds = project.updates.map((u) => u.authorId)
  const authorIds    = allAuthorIds.filter((id, idx) => allAuthorIds.indexOf(id) === idx)
  const authors   = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true },
  })
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a.name]))

  const statusMeta = STATUS_META[project.status] ?? STATUS_META.planned
  const riskMeta   = RISK_META[project.riskLevel] ?? RISK_META.low
  const done       = project.milestones.filter((m) => m.isCompleted).length
  const total      = project.milestones.length

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/projetos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" />
        Projetos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskMeta.cls}`}>
              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
              {riskMeta.label}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          {project.objective && (
            <p className="text-sm text-gray-600 mt-1 max-w-2xl whitespace-pre-line">{project.objective}</p>
          )}
        </div>
        {canManage && (
          <Link
            href={`/projetos/${project.id}/editar`}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:border-gray-300 hover:text-gray-800 transition-colors flex-shrink-0"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </Link>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
              <User className="w-3.5 h-3.5" /> Responsável
            </p>
            <p className="text-sm font-medium text-gray-800">{project.responsibleUser.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
              <Calendar className="w-3.5 h-3.5" /> Início
            </p>
            <p className="text-sm font-medium text-gray-800">
              {project.startDate ? formatDate(project.startDate) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
              <Calendar className="w-3.5 h-3.5" /> Previsão
            </p>
            <p className={`text-sm font-medium ${
              project.expectedEndDate && new Date(project.expectedEndDate) < new Date() && project.status !== 'completed'
                ? 'text-red-600'
                : 'text-gray-800'
            }`}>
              {project.expectedEndDate ? formatDate(project.expectedEndDate) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
              <Briefcase className="w-3.5 h-3.5" /> Marcos
            </p>
            <p className="text-sm font-medium text-gray-800">{done}/{total} concluídos</p>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <MilestoneList
        projectId={project.id}
        milestones={project.milestones.map((m) => ({
          ...m,
          dueDate:     new Date(m.dueDate),
          completedAt: m.completedAt ? new Date(m.completedAt) : null,
        }))}
        canManage={canManage}
      />

      {/* Demandas vinculadas */}
      {project.demands.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Demandas Vinculadas ({project.demands.length})
          </h3>
          <div className="space-y-2">
            {project.demands.map((d) => (
              <Link
                key={d.id}
                href={`/demandas/${d.id}`}
                className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 hover:text-blue-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <PriorityBadge priority={d.priority} />
                    <StatusBadge status={d.status} isOverdue={d.isOverdue} />
                    <span className="text-xs text-gray-400">{d.area.name} · {d.responsible.name}</span>
                  </div>
                </div>
                <span className={`text-xs flex-shrink-0 font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                  {formatDate(d.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Atualizações */}
      <ProjectUpdateForm
        projectId={project.id}
        initialUpdates={project.updates.map((u) => ({
          id:          u.id,
          content:     u.content,
          createdAt:   new Date(u.createdAt),
          authorName:  authorMap[u.authorId] ?? 'Usuário',
        }))}
        canAdd={canManage}
      />
    </div>
  )
}
