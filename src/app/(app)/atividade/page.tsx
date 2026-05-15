import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds, isDirector, isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { Activity, ClipboardList, Briefcase } from 'lucide-react'
import { subDays, startOfDay, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type FeedItem = {
  id: string
  type: 'demand_update' | 'project_update'
  authorId: string
  content: string
  createdAt: Date
  demandId?: string
  demandTitle?: string
  projectId?: string
  projectName?: string
}

export default async function AtividadePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/meu-workspace')

  const since    = subDays(new Date(), 7)
  const areaIds  = getUserAreaIds(session)
  const dir      = isDirector(session.user.role)

  const [demandUpdates, projectUpdates] = await Promise.all([
    prisma.demandUpdate.findMany({
      where: {
        createdAt: { gte: since },
        ...(areaIds && !dir ? { demand: { OR: [
          { areaId: { in: areaIds } },
          { requestingAreaId: { in: areaIds } },
        ] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        demand: { select: { id: true, title: true } },
      },
    }),
    prisma.projectUpdate.findMany({
      where: {
        createdAt: { gte: since },
        ...(!dir ? { project: { responsibleId: session.user.id } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
  ])

  // Agrega todos os IDs de autores
  const allAuthorIds = [
    ...demandUpdates.map((u) => u.authorId),
    ...projectUpdates.map((u) => u.authorId),
  ]
  const uniqueAuthorIds = allAuthorIds.filter((id, idx) => allAuthorIds.indexOf(id) === idx)
  const authors = await prisma.user.findMany({
    where: { id: { in: uniqueAuthorIds } },
    select: { id: true, name: true },
  })
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a.name]))

  // Monta feed unificado
  const feed: FeedItem[] = [
    ...demandUpdates.map((u) => ({
      id:           u.id,
      type:         'demand_update' as const,
      authorId:     u.authorId,
      content:      u.content ?? '',
      createdAt:    u.createdAt,
      demandId:     u.demand.id,
      demandTitle:  u.demand.title,
    })),
    ...projectUpdates.map((u) => ({
      id:          u.id,
      type:        'project_update' as const,
      authorId:    u.authorId,
      content:     u.content,
      createdAt:   u.createdAt,
      projectId:   u.project.id,
      projectName: u.project.name,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // Agrupa por dia
  const groups = new Map<string, FeedItem[]>()
  for (const item of feed) {
    const day = format(startOfDay(item.createdAt), "EEEE, d 'de' MMMM", { locale: ptBR })
    const key = day.charAt(0).toUpperCase() + day.slice(1)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Feed de Atividade
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Últimos 7 dias — demandas e projetos
        </p>
      </div>

      {feed.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhuma atividade nos últimos 7 dias
        </div>
      ) : (
        Array.from(groups.entries()).map(([day, items]) => (
          <div key={day}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {day}
            </p>
            <div className="space-y-2">
              {items.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  authorName={authorMap[item.authorId] ?? 'Usuário'}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function FeedCard({ item, authorName }: { item: FeedItem; authorName: string }) {
  const isDemand = item.type === 'demand_update'

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isDemand ? 'bg-blue-100' : 'bg-purple-100'
      }`}>
        {isDemand
          ? <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
          : <Briefcase className="w-3.5 h-3.5 text-purple-600" />
        }
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-xs font-semibold text-gray-800">{authorName}</span>
          <span className="text-xs text-gray-400">
            {isDemand ? 'atualizou a demanda' : 'atualizou o projeto'}
          </span>
          <Link
            href={isDemand ? `/demandas/${item.demandId}` : `/projetos/${item.projectId}`}
            className="text-xs font-medium text-blue-600 hover:underline truncate max-w-xs"
          >
            {isDemand ? item.demandTitle : item.projectName}
          </Link>
        </div>

        {item.content && (
          <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-line">
            {item.content}
          </p>
        )}

        <p className="text-xs text-gray-400 mt-1">
          {timeAgo(item.createdAt)}
        </p>
      </div>
    </div>
  )
}
