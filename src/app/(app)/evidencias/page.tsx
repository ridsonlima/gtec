import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { Eye, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  {
    label: 'Pendente',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  received: {
    label: 'Recebida',
    color: 'text-green-700 bg-green-50 border-green-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Rejeitada',
    color: 'text-red-700 bg-red-50 border-red-200',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
}

export default async function EvidenciasPage() {
  const session = await auth()
  if (!session) return null

  const areaIds = getUserAreaIds(session)

  const evidenceRequests = await prisma.evidenceRequest.findMany({
    where: {
      ...(areaIds
        ? {
            OR: [
              { reportRef: { areaId: { in: areaIds } } },
              { demandRef: { areaId: { in: areaIds } } },
            ],
          }
        : {}),
    },
    orderBy: [
      { status: 'asc' },  // pending first
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 50,
    include: {
      responsible: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
      reportRef:   { select: { id: true, title: true, area: { select: { name: true } } } },
      demandRef:   { select: { id: true, title: true } },
    },
  })

  const pending  = evidenceRequests.filter((e) => e.status === 'pending')
  const received = evidenceRequests.filter((e) => e.status === 'received')
  const rejected = evidenceRequests.filter((e) => e.status === 'rejected')

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Evidências
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pedidos de evidências e comprovações solicitadas pela diretoria
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{pending.length}</p>
          <p className="text-xs text-amber-600 mt-0.5">Pendentes</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{received.length}</p>
          <p className="text-xs text-green-600 mt-0.5">Recebidas</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{rejected.length}</p>
          <p className="text-xs text-red-600 mt-0.5">Rejeitadas</p>
        </div>
      </div>

      {evidenceRequests.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhum pedido de evidência registrado
        </div>
      ) : (
        <div className="space-y-2">
          {evidenceRequests.map((ev) => {
            const config = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pending
            const target = ev.reportRef ?? ev.demandRef
            const targetHref = ev.reportRef
              ? `/reports/${ev.reportRef.id}`
              : ev.demandRef
              ? `/demandas/${ev.demandRef.id}`
              : '#'

            const isOverdue = ev.status === 'pending' && ev.dueDate && new Date(ev.dueDate) < new Date()

            return (
              <div
                key={ev.id}
                className={`bg-white rounded-xl border px-5 py-4 ${
                  isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border
                                        flex items-center gap-1 ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </span>
                      {isOverdue && (
                        <span className="text-xs font-bold text-red-600">VENCIDA</span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-gray-800 line-clamp-2">
                      {ev.description}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                      <span>Solicitado por <strong>{ev.requestedBy.name}</strong></span>
                      <span>Para <strong>{ev.responsible.name}</strong></span>
                      {ev.dueDate && (
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          Prazo: {formatDate(ev.dueDate)}
                        </span>
                      )}
                    </div>

                    {target && (
                      <Link
                        href={targetHref}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {ev.reportRef?.area?.name && `${ev.reportRef.area.name} · `}
                        {target.title}
                      </Link>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right text-xs text-gray-400">
                    <p>{timeAgo(new Date(ev.createdAt))}</p>
                    <Link
                      href={targetHref}
                      className="text-blue-600 hover:underline mt-1 block"
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
