import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea, canManageSeguranca } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { DemandSignalBadges } from '@/components/demands/DemandSignalBadges'
import { computeDemandSignals } from '@/lib/demandSignals'
import {
  FileText, AlertTriangle, Briefcase, Plus, ChevronRight,
  Clock, CheckCircle2, AlertCircle, CalendarRange, Edit2,
} from 'lucide-react'
import { AccidentesTab } from '@/components/seguranca/AccidentesTab'
import { DashboardSeguranca } from '@/components/seguranca/DashboardSeguranca'
import { AreaFiltro } from '@/components/areas/AreaFiltro'
import { AcompanhamentoPanel } from '@/components/acompanhamento/AcompanhamentoPanel'
import { GestaoObraPanel } from '@/components/obras/GestaoObraPanel'

export default async function AreaDetailPage({
  params,
  searchParams,
}: {
  params: { areaId: string }
  searchParams: { tab?: string; resp?: string; contrato?: string }
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
    'meio-ambiente': 'SESMT_MA',
    'seg-trabalho': 'SESMT_SEG',
    equipamentos: 'EQUIP',
  }

  const areaCode = areaSlugMap[params.areaId]
  const area = await prisma.area.findFirst({
      where: areaCode ? { code: areaCode } : { id: params.areaId },
      include: {
        responsible: { select: { id: true, name: true } },
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

  // Filtros (responsável / contrato)
  const fResp = searchParams.resp || undefined
  const fContrato = searchParams.contrato || undefined

  const [reports, demands, contracts] = await Promise.all([
    prisma.report.findMany({
      where: {
        areaId: area.id,
        ...(fResp ? { authorId: fResp } : {}),
        ...(fContrato ? { contractId: fContrato } : {}),
      },
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
        ...(fResp ? { responsibleId: fResp } : {}),
        ...(fContrato ? { contractId: fContrato } : {}),
      },
      orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
      take: 12,
      include: {
        responsible: { select: { id: true, name: true } },
        contract: { select: { id: true, number: true } },
        _count: { select: { comments: true, attachments: true } },
        updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    }),

    prisma.contract.findMany({
      where: {
        areaId: area.id,
        status: { not: 'completed' },
        ...(fResp ? { responsibleId: fResp } : {}),
        ...(fContrato ? { id: fContrato } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        responsible: { select: { id: true, name: true } },
      },
    }),
  ])

  // Mapa de "última visualização" do usuário → selo "Novo" nas demandas
  const demandViews = await prisma.demandView.findMany({
    where: { userId: session.user.id, demandId: { in: demands.map((d) => d.id) } },
    select: { demandId: true, viewedAt: true },
  })
  const viewMap = new Map(demandViews.map((v) => [v.demandId, v.viewedAt]))

  // Opções dos filtros (responsáveis e contratos da área)
  const [contratosArea, demandResp, contractResp, reportAuthors] = await Promise.all([
    prisma.contract.findMany({ where: { areaId: area.id }, select: { id: true, number: true, name: true }, orderBy: { number: 'asc' } }),
    prisma.demand.findMany({ where: { areaId: area.id }, select: { responsibleId: true }, distinct: ['responsibleId'] }),
    prisma.contract.findMany({ where: { areaId: area.id }, select: { responsibleId: true }, distinct: ['responsibleId'] }),
    prisma.report.findMany({ where: { areaId: area.id }, select: { authorId: true }, distinct: ['authorId'] }),
  ])
  const userIds = Array.from(new Set([
    ...demandResp.map((d) => d.responsibleId),
    ...contractResp.map((c) => c.responsibleId),
    ...reportAuthors.map((r) => r.authorId),
  ].filter((x): x is string => !!x)))
  const usuariosFiltro = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    : []
  const filtroUsuarios = usuariosFiltro.map((u) => ({ id: u.id, label: u.name }))
  const filtroContratos = contratosArea.map((c) => ({ id: c.id, label: `${c.number} — ${c.name}` }))

  const isSegTrabalho = params.areaId === 'seg-trabalho'
  const isPlanejamento = params.areaId === 'planejamento'
  const isObrasProprias = params.areaId === 'obras-proprias'
  const hasTabs = isSegTrabalho || isPlanejamento || isObrasProprias
  const activeTab = hasTabs ? (searchParams.tab ?? 'visao-geral') : 'visao-geral'

  const isDirector = session.user.role === 'master' || session.user.role === 'director' || session.user.role === 'admin'
  const canWrite =
    (session.user.role === 'master' || session.user.role === 'admin') ||
    session.user.areaScopes?.some((s) => s.areaId === area.id && s.canWrite)

  const overdueDemands = demands.filter((d) => d.isOverdue).length
  const demandsAltaPrioridade = demands.filter((d) => d.priority === 'critical' || d.priority === 'high').length
  const publishedReports = reports.filter((r) => r.status === 'published').length
  const responsible = area.responsible ?? area.userScopes[0]?.user

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

      {/* Tab bar — only for Seg. do Trab. */}
      {isSegTrabalho && (
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { key: 'visao-geral', label: 'Visão Geral', href: '/areas/seg-trabalho' },
            { key: 'dashboard',   label: 'Dashboard',   href: '/areas/seg-trabalho?tab=dashboard' },
            { key: 'acidentes',   label: 'Acidentes',   href: '/areas/seg-trabalho?tab=acidentes' },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* Tab bar — Planejamento (Acompanhamento de Obras) */}
      {isPlanejamento && (
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { key: 'visao-geral',    label: 'Visão Geral',            href: '/areas/planejamento' },
            { key: 'acompanhamento', label: 'Acompanhamento de Obras', href: '/areas/planejamento?tab=acompanhamento' },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* Acompanhamento de Obras (Planejamento) */}
      {isPlanejamento && activeTab === 'acompanhamento' && (
        <AcompanhamentoPanel />
      )}

      {/* Tab bar — Obras Próprias (Gestão de Obra) */}
      {isObrasProprias && (
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { key: 'visao-geral', label: 'Visão Geral',     href: '/areas/obras-proprias' },
            { key: 'gestao',      label: 'Gestão de Obra',  href: '/areas/obras-proprias?tab=gestao' },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* Gestão de Obra (Obras Próprias) */}
      {isObrasProprias && activeTab === 'gestao' && (
        <GestaoObraPanel />
      )}

      {/* Dashboard tab */}
      {isSegTrabalho && activeTab === 'dashboard' && (
        <DashboardSeguranca canManage={canManageSeguranca(session)} />
      )}

      {/* Accidents tab */}
      {isSegTrabalho && activeTab === 'acidentes' && (
        <AccidentesTab />
      )}

      {/* Main area content — hidden when accidents tab is active */}
      {activeTab === 'visao-geral' && (
      <>

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

      {(filtroUsuarios.length > 0 || filtroContratos.length > 0) && (
        <AreaFiltro usuarios={filtroUsuarios} contratos={filtroContratos} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ★ Demandas — protagonista */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              Demandas
              <span className="text-xs font-normal text-gray-400 normal-case ml-1">({demands.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              {canWrite && (
                <Link href={`/demandas/nova?areaId=${area.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-white bg-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-700">
                  <Plus className="w-3 h-3" /> Nova
                </Link>
              )}
              <Link href={`/demandas?areaId=${area.id}`} className="text-xs text-blue-600 hover:underline">Ver todas</Link>
            </div>
          </div>

          {/* mini-resumo */}
          {demands.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                {demands.length} aberta{demands.length !== 1 ? 's' : ''}
              </span>
              {overdueDemands > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-700 px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> {overdueDemands} vencida{overdueDemands !== 1 ? 's' : ''}
                </span>
              )}
              {demandsAltaPrioridade > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                  {demandsAltaPrioridade} alta prioridade
                </span>
              )}
            </div>
          )}

          {demands.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              Nenhuma demanda aberta.
              {canWrite && (
                <Link href={`/demandas/nova?areaId=${area.id}`} className="block mt-2 text-blue-600 hover:underline">
                  Criar primeira demanda &rarr;</Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {demands.map((d) => {
                const dias = d.dueDate ? Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86400000) : null
                const signals = computeDemandSignals({
                  status: d.status,
                  dueDate: d.dueDate,
                  updatedAt: d.updatedAt,
                  createdAt: d.createdAt,
                  lastActivityAt: d.updates[0]?.createdAt ?? d.createdAt,
                  viewedAt: viewMap.get(d.id),
                })
                return (
                  <Link
                    key={d.id}
                    href={`/demandas/${d.id}`}
                    className={`block rounded-xl border px-4 py-3 hover:shadow-md transition-shadow ${signals.unread ? 'bg-blue-50/60' : 'bg-white'} ${d.isOverdue ? 'border-l-4 border-l-red-500 border-gray-100' : 'border-gray-100'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <PriorityBadge priority={d.priority} />
                          <StatusBadge status={d.status} />
                          <DemandSignalBadges d={signals} />
                        </div>
                        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{d.title}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {d.responsible?.name ?? '—'}</span>
                          {d.contract && <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> {d.contract.number}</span>}
                          {d._count.comments > 0 && <span>{d._count.comments} coment.</span>}
                          {d._count.attachments > 0 && <span>{d._count.attachments} anexo(s)</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={`text-xs font-semibold ${d.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {d.dueDate ? formatDate(d.dueDate) : '—'}
                        </p>
                        {dias !== null && (
                          <p className={`text-[11px] mt-0.5 ${d.isOverdue ? 'text-red-500' : dias <= 3 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {d.isOverdue ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : `em ${dias}d`}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Contratos + Reports */}
        <div className="space-y-5">
          {/* Contratos */}
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
                    className="block bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-gray-500">{c.number}</p>
                        <p className="text-sm text-gray-800 font-medium truncate">{c.name}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${contractStatusColor[c.status] ?? 'text-gray-500 bg-gray-100'}`}>
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

          {/* Reports (secundário) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Reports
              </h2>
              {canWrite && (
                <Link href={`/reports/novo?areaId=${area.id}`} className="text-xs text-blue-600 hover:underline">+ Novo</Link>
              )}
            </div>
            {reports.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                Nenhum report ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {reports.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href={`/reports/${r.id}`}
                    className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:shadow-sm transition-shadow group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <StatusBadge status={r.status} />
                        {r.hasCritical && <span className="text-[11px] text-red-600">Crítico</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 truncate">{r.author.name} · {timeAgo(new Date(r.createdAt))}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      </> /* end visao-geral */
      )}
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


