import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import {
  FileText, AlertTriangle, Briefcase, Plus, ChevronRight,
  Clock, CheckCircle2, AlertCircle, CalendarRange, Edit2,
} from 'lucide-react'

export default async function AreaDetailPage({
  params,
}: {
  params: { areaId: string }
}) {
  const session = await auth()
  if (!session) return null

  const areaSlugMap: Record<string, string> = {
    'sala-tecnica': 'PLAN',
    planejamento: 'PLAN_PLANEJ',
    orcamento: 'PLAN_ORC',
    'obras-proprias': 'OBRAS_PROP',
    'obras-terceirizadas': 'OBRAS_TERC',
    sesmt: 'SESMT',
    equipamentos: 'EQUIP',
  }

  const areaCode = areaSlugMap[params.areaId]
  const area = await prisma.area.findFirst({
      where: areaCode ? { code: areaCode } : { id: params.areaId },
      include: {
        userScopes: {
          where: { isPrimary: true },
          take: 1,
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { reports: true, demands: true, contracts: true } },
      },
    })

  if (!area) notFound()
  if (!canAccessArea(session, area.id)) notFound()

  const [reports, demands, contracts] = await Promise.all([
    prisma.report.findMany({
      where: { areaId: area.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        author: { select: { id: true, name: true } },
        contract: { select: { id: true, number: true } },
      },
    }),

    prisma.demand.findMany({
      where: {
        areaId: area.id,
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
      take: 8,
      include: {
        responsible: { select: { id: true, name: true } },
      },
    }),

    prisma.contract.findMany({
      where: { areaId: area.id, status: { not: 'completed' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        responsible: { select: { id: true, name: true } },
      },
    }),
  ])

  const isDirector = session.user.role === 'master' || session.user.role === 'director' || session.user.role === 'admin'
  const canWrite =
    (session.user.role === 'master' || session.user.role === 'admin') ||
    session.user.areaScopes?.some((s) => s.areaId === area.id && s.canWrite)

  const overdueDemands = demands.filter((d) => d.isOverdue).length
  const publishedReports = reports.filter((r) => r.status === 'published').length
  const lastReport = reports.find((r) => r.status === 'published')
  const responsible = area.userScopes[0]?.user

  const contractStatusColor: Record<string, string> = {
    active:    'text-green-600 bg-green-50',
    at_risk:   'text-red-600 bg-red-50',
    delayed:   'text-amber-600 bg-amber-50',
    suspended: 'text-gray-500 bg-gray-100',
    completed: 'Concluído',
  }
  const contractStatusLabel: Record<string, string> = {
    active:    'Ativo',
    at_risk:   'Em risco',
    delayed:   'Atrasado',
    suspended: 'Suspenso',
    completed: 'ConcluÃ­do',
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">{area.isOperational ? 'Área Operacional' : 'Área de Apoio'}</p>
          <h1 className="text-2xl font-bold text-gray-900">{area.name}</h1>
          {area.description && (
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">{area.description}</p>
          )}
          {responsible && (
            <p className="text-sm text-gray-500 mt-1">
              Responsável: <span className="font-medium text-gray-700">{responsible.name}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canWrite && (
            <Link
              href={`/reports/novo?areaId=${area.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white
                         text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Report
            </Link>
          )}
          {isDirector && (
            <>
              <Link
                href={`/areas/${params.areaId}/editar`}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar área
              </Link>
              <Link
                href={`/pauta?areaId=${area.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CalendarRange className="w-4 h-4" />
                Pautas
              </Link>
              <Link
                href={`/demandas/nova?areaId=${area.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Demanda
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Reports publicados"
          value={publishedReports}
          icon={<FileText className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          label="Demandas abertas"
          value={demands.length}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="gray"
        />
        <StatCard
          label="Demandas vencidas"
          value={overdueDemands}
          icon={<AlertCircle className="w-4 h-4" />}
          color={overdueDemands > 0 ? 'red' : 'gray'}
        />
        <StatCard
          label="Contratos ativos"
          value={area._count.contracts}
          icon={<Briefcase className="w-4 h-4" />}
          color="gray"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Reports */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Reports
              {lastReport && (
                <span className="text-xs font-normal text-gray-400 normal-case ml-1">
                  - último: {timeAgo(new Date(lastReport.createdAt))}
                </span>
              )}
            </h2>
          </div>

          {reports.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              Nenhum report ainda.
              {canWrite && (
                <Link href={`/reports/novo?areaId=${area.id}`} className="block mt-2 text-blue-600 hover:underline">
                  Criar primeiro report &rarr;</Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/reports/${r.id}`}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100
                             px-4 py-3 hover:shadow-sm transition-shadow group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <StatusBadge status={r.status} />
                      {r.hasCritical && (
                        <span className="text-xs text-red-600">Crítico</span>
                      )}
                      {r.hasDecisionNeeded && (
                        <span className="text-xs text-amber-600">Decisão</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400">
                      {r.author.name}
                      {r.contract && ` Â· ${r.contract.number}`}
                      {' Â· '}{timeAgo(new Date(r.createdAt))}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Demands + Contracts */}
        <div className="space-y-5">
          {/* Demands */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Demandas Abertas
              </h2>
              <Link href={`/demandas?areaId=${area.id}`} className="text-xs text-blue-600 hover:underline">
                Ver todas
              </Link>
            </div>

            {demands.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                Nenhuma demanda aberta
              </div>
            ) : (
              <div className="space-y-2">
                {demands.map((d) => (
                  <Link
                    key={d.id}
                    href={`/demandas/${d.id}`}
                    className="block bg-white rounded-xl border border-gray-100 px-3 py-2.5
                               hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {d.isOverdue && (
                          <span className="text-xs font-bold text-red-600">VENCIDA Â· </span>
                        )}
                        <span className="text-sm text-gray-800 font-medium line-clamp-2">{d.title}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <PriorityBadge priority={d.priority} />
                          <span className="text-xs text-gray-400">{d.responsible?.name}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={`text-xs font-medium ${d.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                          {d.dueDate ? formatDate(d.dueDate) : 'â€”'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contracts */}
          {contracts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Briefcase className="w-4 h-4" />
                Contratos
              </h2>
              <div className="space-y-2">
                {contracts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contratos/${c.id}`}
                    className="block bg-white rounded-xl border border-gray-100 px-3 py-2.5
                               hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-gray-500">{c.number}</p>
                        <p className="text-sm text-gray-800 font-medium truncate">{c.name}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
                                        ${contractStatusColor[c.status] ?? 'text-gray-500 bg-gray-100'}`}>
                        {contractStatusLabel[c.status] ?? c.status}
                      </span>
                    </div>
                    {c.endDate && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Vigência até {formatDate(c.endDate)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, color,
}: {
  label: string; value: number; icon: React.ReactNode; color: 'blue' | 'red' | 'gray'
}) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    red:  'text-red-600 bg-red-50',
    gray: 'text-gray-600 bg-gray-100',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}


