import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'
import { MessageSquare, Eye, AtSign, AlertCircle } from 'lucide-react'
import { InteracoesFilters } from './InteracoesFilters'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  observation:      { label: 'Observação',         color: 'bg-gray-100 text-gray-600' },
  clarification:    { label: 'Solicitação',         color: 'bg-blue-50 text-blue-700' },
  follow_up:        { label: 'Cobrança',            color: 'bg-purple-50 text-purple-700' },
  evidence_request: { label: 'Pedido de Evidência', color: 'bg-amber-50 text-amber-700' },
}

const TABS = [
  { key: 'all',     label: 'Todos' },
  { key: 'mine',    label: 'Para mim' },
  { key: 'pending', label: 'Pendentes' },
]

export default async function InteracoesPage({
  searchParams,
}: {
  searchParams: { tab?: string; type?: string; search?: string }
}) {
  const session = await auth()
  if (!session) return null

  const tab    = searchParams.tab    ?? 'all'
  const type   = searchParams.type   ?? ''
  const search = searchParams.search ?? ''

  const areaIds = getUserAreaIds(session)
  const userId  = session.user.id

  // ── Base de acesso por área ──────────────────────────────────────────────
  const areaFilter = areaIds
    ? {
        OR: [
          { reportRef: { areaId: { in: areaIds } } },
          { demandRef: { areaId: { in: areaIds } } },
          { demandRef: { requestingAreaId: { in: areaIds } } },
        ],
      }
    : {}

  // ── Filtro por aba ───────────────────────────────────────────────────────
  let tabFilter: any = {}
  if (tab === 'mine') {
    tabFilter = {
      OR: [
        { mentions: { some: { userId } } },
        { demandRef: { responsibleId: userId } },
        { demandRef: { collaborators: { some: { userId } } } },
        { authorId: userId },
      ],
    }
  } else if (tab === 'pending') {
    tabFilter = {
      isResolved: false,
      type: { in: ['follow_up', 'evidence_request'] },
      ...(areaIds ? areaFilter : {}),
    }
  }

  // ── Filtro por tipo ──────────────────────────────────────────────────────
  const typeFilter = type ? { type } : {}

  // ── Busca ────────────────────────────────────────────────────────────────
  const searchFilter = search ? { content: { contains: search } } : {}

  const where: any = {
    parentId: null,
    ...(tab !== 'pending' ? areaFilter : {}),
    ...(tab === 'mine' || tab === 'pending' ? tabFilter : {}),
    ...typeFilter,
    ...searchFilter,
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      author:          { select: { id: true, name: true, role: true } },
      reportRef:       { select: { id: true, title: true, area: { select: { name: true } } } },
      demandRef:       { select: { id: true, title: true } },
      evidenceRequest: { select: { id: true, status: true } },
      mentions:        { select: { userId: true, user: { select: { name: true } } } },
      _count:          { select: { replies: true } },
    },
  })

  // Conta por aba para exibir badges
  const [countMine, countPending] = await Promise.all([
    prisma.comment.count({
      where: {
        parentId: null,
        ...(areaIds ? areaFilter : {}),
        OR: [
          { mentions: { some: { userId } } },
          { demandRef: { responsibleId: userId } },
          { demandRef: { collaborators: { some: { userId } } } },
        ],
      },
    }),
    prisma.comment.count({
      where: {
        parentId: null,
        isResolved: false,
        type: { in: ['follow_up', 'evidence_request'] },
        ...(areaIds ? areaFilter : {}),
      },
    }),
  ])

  const buildHref = (params: Record<string, string>) => {
    const p = new URLSearchParams()
    if (params.tab && params.tab !== 'all') p.set('tab', params.tab)
    if (params.type) p.set('type', params.type)
    if (params.search) p.set('search', params.search)
    const s = p.toString()
    return `/interacoes${s ? '?' + s : ''}`
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Interações
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Comentários, cobranças e menções em reports e demandas
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const isActive = tab === t.key
          const count = t.key === 'mine' ? countMine : t.key === 'pending' ? countPending : null
          return (
            <Link
              key={t.key}
              href={buildHref({ tab: t.key, type, search })}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
              {count != null && count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Filtros client-side */}
      <InteracoesFilters
        currentType={type}
        currentSearch={search}
        currentTab={tab}
      />

      {/* Lista */}
      {comments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhuma interação encontrada
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => {
            const meta      = TYPE_LABELS[c.type] ?? TYPE_LABELS.observation
            const target    = c.reportRef ?? c.demandRef
            const targetHref = c.reportRef
              ? `/reports/${c.reportRef.id}`
              : c.demandRef
              ? `/demandas/${c.demandRef.id}`
              : '#'
            const isMentioned = c.mentions.some((m) => m.userId === userId)
            const isPendingEvidence =
              c.evidenceRequest && c.evidenceRequest.status === 'pending'
            const isUnresolvedFollowUp =
              c.type === 'follow_up' && !c.isResolved

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border px-5 py-4 ${
                  isMentioned ? 'border-blue-200 shadow-sm' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                        {meta.label}
                      </span>

                      {isMentioned && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          <AtSign className="w-3 h-3" />
                          você
                        </span>
                      )}

                      {(isPendingEvidence || isUnresolvedFollowUp) && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertCircle className="w-3 h-3" />
                          pendente
                        </span>
                      )}

                      {c.evidenceRequest && c.evidenceRequest.status === 'received' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          <Eye className="w-3 h-3" />
                          Evidência recebida
                        </span>
                      )}

                      <span className="text-xs text-gray-500 font-medium">{c.author.name}</span>
                      <span className="text-xs text-gray-400">{timeAgo(new Date(c.createdAt))}</span>
                    </div>

                    <p className="text-sm text-gray-800 line-clamp-2 whitespace-pre-line">{c.content}</p>

                    {c.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.mentions.map((m) => (
                          <span key={m.userId} className="text-xs text-blue-600">
                            @{m.user.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {target && (
                      <Link href={targetHref} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        {c.reportRef?.area?.name && `${c.reportRef.area.name} · `}
                        {target.title}
                      </Link>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    {c._count.replies > 0 && (
                      <p className="text-xs text-gray-400">
                        {c._count.replies} resposta{c._count.replies !== 1 ? 's' : ''}
                      </p>
                    )}
                    <Link href={targetHref} className="text-xs text-gray-400 hover:text-blue-600 mt-1 block">
                      Ver →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
