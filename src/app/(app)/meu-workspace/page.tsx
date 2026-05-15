import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Briefcase,
  Eye,
  CheckCircle2,
  Clock,
} from 'lucide-react'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export default async function MeuWorkspacePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const [openDemands, myProjects, pendingEvidence, recentActivity] = await Promise.all([
    // Minhas demandas abertas (responsável)
    prisma.demand.findMany({
      where: {
        responsibleId: userId,
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
      take: 20,
      include: {
        area: { select: { name: true } },
      },
    }),

    // Meus projetos
    prisma.project.findMany({
      where: {
        responsibleId: userId,
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        milestones: { select: { isCompleted: true } },
        _count: { select: { demands: true } },
      },
    }),

    // Evidências pendentes a mim
    prisma.evidenceRequest.findMany({
      where: { responsibleId: userId, status: 'pending' },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: {
        requestedBy: { select: { name: true } },
        reportRef:   { select: { id: true, title: true } },
        demandRef:   { select: { id: true, title: true } },
      },
    }),

    // Atividade recente (atualizações que fiz)
    prisma.demandUpdate.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        demand: { select: { id: true, title: true, status: true } },
      },
    }),
  ])

  const overdue   = openDemands.filter((d) => d.isOverdue)
  const upcoming  = openDemands.filter((d) => !d.isOverdue)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  const projectsInProgress = myProjects.filter((p) => p.status === 'in_progress')
  const projectsPlanned    = myProjects.filter((p) => p.status === 'planned')

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5" />
          Meu Workspace
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Suas demandas, projetos e pendências em um só lugar
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Demandas em aberto"
          value={openDemands.length}
          color={overdue.length > 0 ? 'amber' : 'blue'}
        />
        <SummaryCard
          label="Vencidas"
          value={overdue.length}
          color={overdue.length > 0 ? 'red' : 'gray'}
        />
        <SummaryCard
          label="Projetos ativos"
          value={projectsInProgress.length}
          color="purple"
        />
        <SummaryCard
          label="Evidências pendentes"
          value={pendingEvidence.length}
          color={pendingEvidence.length > 0 ? 'amber' : 'gray'}
        />
      </div>

      {/* Demandas vencidas */}
      {overdue.length > 0 && (
        <Section
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          title={`Demandas Vencidas (${overdue.length})`}
          borderColor="border-red-200"
        >
          <div className="divide-y divide-gray-50">
            {overdue.map((d) => (
              <DemandRow key={d.id} demand={d} />
            ))}
          </div>
        </Section>
      )}

      {/* Demandas em aberto */}
      {upcoming.length > 0 && (
        <Section
          icon={<ClipboardList className="w-4 h-4 text-blue-500" />}
          title={`Demandas em Aberto (${upcoming.length})`}
        >
          <div className="divide-y divide-gray-50">
            {upcoming.map((d) => (
              <DemandRow key={d.id} demand={d} />
            ))}
          </div>
        </Section>
      )}

      {openDemands.length === 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-700">Nenhuma demanda em aberto</p>
          <p className="text-xs text-green-500 mt-0.5">Tudo em dia!</p>
        </div>
      )}

      {/* Meus projetos */}
      {myProjects.length > 0 && (
        <Section
          icon={<Briefcase className="w-4 h-4 text-purple-500" />}
          title="Meus Projetos"
        >
          <div className="grid sm:grid-cols-2 gap-3 p-4">
            {[...projectsInProgress, ...projectsPlanned].map((p) => {
              const done  = p.milestones.filter((m) => m.isCompleted).length
              const total = p.milestones.length
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <Link
                  key={p.id}
                  href={`/projetos/${p.id}`}
                  className="border border-gray-100 rounded-lg p-3 hover:border-blue-200 hover:bg-blue-50/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{p.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      p.status === 'in_progress'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {p.status === 'in_progress' ? 'Em andamento' : 'Planejado'}
                    </span>
                  </div>
                  {total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Marcos</span>
                        <span>{done}/{total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-green-500' : 'bg-blue-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {/* Evidências pendentes */}
      {pendingEvidence.length > 0 && (
        <Section
          icon={<Eye className="w-4 h-4 text-amber-500" />}
          title={`Evidências Pendentes para Mim (${pendingEvidence.length})`}
          borderColor="border-amber-200"
        >
          <div className="divide-y divide-gray-50">
            {pendingEvidence.map((ev) => {
              const target = ev.reportRef ?? ev.demandRef
              const href   = ev.reportRef
                ? `/reports/${ev.reportRef.id}`
                : ev.demandRef
                ? `/demandas/${ev.demandRef.id}`
                : '/evidencias'
              const isOverdue = ev.dueDate && new Date(ev.dueDate) < new Date()
              return (
                <div key={ev.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">{ev.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Solicitado por <strong>{ev.requestedBy.name}</strong>
                        {ev.dueDate && (
                          <span className={isOverdue ? ' · text-red-600 font-medium' : ' · '}>
                            {isOverdue ? 'VENCIDA: ' : 'Prazo: '}
                            {formatDate(ev.dueDate)}
                          </span>
                        )}
                      </p>
                      {target && (
                        <Link href={href} className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
                          {target.title}
                        </Link>
                      )}
                    </div>
                    <Link
                      href="/evidencias"
                      className="text-xs text-blue-600 hover:underline flex-shrink-0"
                    >
                      Responder →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Atividade recente */}
      {recentActivity.length > 0 && (
        <Section
          icon={<Clock className="w-4 h-4 text-gray-400" />}
          title="Minha Atividade Recente"
        >
          <div className="divide-y divide-gray-50">
            {recentActivity.map((upd) => (
              <div key={upd.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
                <div className="min-w-0">
                  <Link
                    href={`/demandas/${upd.demand.id}`}
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 line-clamp-1"
                  >
                    {upd.demand.title}
                  </Link>
                  {upd.content && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{upd.content}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(upd.createdAt)}</p>
                </div>
                <StatusBadge status={upd.demand.status} isOverdue={false} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'blue' | 'red' | 'amber' | 'gray' | 'purple'
}) {
  const colorMap = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    red:    'bg-red-50 border-red-100 text-red-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
    gray:   'bg-gray-50 border-gray-100 text-gray-500',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  }
  const numMap = {
    blue:   'text-blue-700',
    red:    'text-red-700',
    amber:  'text-amber-700',
    gray:   'text-gray-500',
    purple: 'text-purple-700',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color]}`}>
      <p className={`text-2xl font-bold ${numMap[color]}`}>{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
  borderColor = 'border-gray-200',
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  borderColor?: string
}) {
  return (
    <div className={`bg-white rounded-xl border ${borderColor} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function DemandRow({ demand }: { demand: any }) {
  return (
    <Link
      href={`/demandas/${demand.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{demand.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <PriorityBadge priority={demand.priority} />
          <StatusBadge status={demand.status} isOverdue={demand.isOverdue} />
          <span className="text-xs text-gray-400">{demand.area.name}</span>
        </div>
      </div>
      <span className={`text-xs flex-shrink-0 font-medium ${demand.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
        {demand.dueDate ? formatDate(demand.dueDate) : '—'}
      </span>
    </Link>
  )
}
