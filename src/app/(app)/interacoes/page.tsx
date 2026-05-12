import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'
import { MessageSquare, Eye } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  observation:      { label: 'Observação',          color: 'bg-gray-100 text-gray-600' },
  clarification:    { label: 'Solicitação',          color: 'bg-blue-50 text-blue-700' },
  follow_up:        { label: 'Acompanhamento',       color: 'bg-purple-50 text-purple-700' },
  evidence_request: { label: 'Pedido de Evidência',  color: 'bg-amber-50 text-amber-700' },
}

export default async function InteracoesPage() {
  const session = await auth()
  if (!session) return null

  const areaIds = getUserAreaIds(session)

  const comments = await prisma.comment.findMany({
    where: {
      parentId: null,
      ...(areaIds
        ? {
            OR: [
              { reportRef: { areaId: { in: areaIds } } },
              { demandRef: { areaId: { in: areaIds } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author:          { select: { id: true, name: true, role: true } },
      reportRef:       { select: { id: true, title: true, area: { select: { name: true } } } },
      demandRef:       { select: { id: true, title: true } },
      evidenceRequest: { select: { id: true, status: true } },
      _count: { select: { replies: true } },
    },
  })

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Interações
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Comentários, solicitações e cobranças em reports e demandas
        </p>
      </div>

      {comments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhuma interação registrada
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => {
            const meta = TYPE_LABELS[c.type] ?? TYPE_LABELS.observation
            const target = c.reportRef ?? c.demandRef
            const targetHref = c.reportRef
              ? `/reports/${c.reportRef.id}`
              : c.demandRef
              ? `/demandas/${c.demandRef.id}`
              : '#'

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-100 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                        {meta.label}
                      </span>
                      {c.evidenceRequest && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1
                          ${c.evidenceRequest.status === 'received'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                          }`}>
                          <Eye className="w-3 h-3" />
                          {c.evidenceRequest.status === 'received' ? 'Evidência recebida' : 'Aguardando evidência'}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-medium">{c.author.name}</span>
                      <span className="text-xs text-gray-400">{timeAgo(new Date(c.createdAt))}</span>
                    </div>

                    <p className="text-sm text-gray-800 line-clamp-2 whitespace-pre-line">
                      {c.content}
                    </p>

                    {target && (
                      <Link
                        href={targetHref}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
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
                    <Link
                      href={targetHref}
                      className="text-xs text-gray-400 hover:text-blue-600 mt-1 block"
                    >
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
