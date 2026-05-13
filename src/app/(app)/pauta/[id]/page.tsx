import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import Link from 'next/link'
import { formatDateTime, formatDate } from '@/lib/utils'
import {
  ChevronLeft, Calendar, Clock, CheckCircle2, Circle, ExternalLink,
} from 'lucide-react'

const ORIGIN_LABELS: Record<string, string> = {
  director:  'Diretoria',
  report:    'Report',
  demand:    'Demanda',
  contract:  'Contrato',
  recurring: 'Recorrente',
  other:     'Outro',
}

const STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  scheduled: 'Agendada',
  done:      'Realizada',
  cancelled: 'Cancelada',
}
const STATUS_COLORS: Record<string, string> = {
  draft:     'text-gray-500 bg-gray-100',
  scheduled: 'text-blue-700 bg-blue-50',
  done:      'text-green-700 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
}

export default async function AgendaDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) return null
  if (!isDirector(session.user.role)) redirect('/dashboard')

  const agenda = await prisma.meetingAgenda.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          report: { select: { id: true, title: true } },
          demand: { select: { id: true, title: true } },
        },
      },
    },
  })

  if (!agenda) notFound()

  const totalMinutes = agenda.items.reduce((acc, i) => acc + (i.estimatedMinutes ?? 0), 0)

  return (
    <div className="max-w-4xl space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/pauta"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
      >
        <ChevronLeft className="w-4 h-4" />
        Pautas
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[agenda.status] ?? ''}`}>
                {STATUS_LABELS[agenda.status] ?? agenda.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{agenda.title}</h1>

            {agenda.objective && (
              <p className="text-sm text-gray-600 mt-2 max-w-2xl">{agenda.objective}</p>
            )}

            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              {agenda.scheduledAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateTime(agenda.scheduledAt)}
                </span>
              )}
              {totalMinutes > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {totalMinutes}min estimados
                </span>
              )}
              <span>
                {agenda.items.length} item{agenda.items.length !== 1 ? 's' : ''} ·
                Criado por {agenda.createdBy.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Itens da Pauta
        </h2>

        {agenda.items.map((item, idx) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-start gap-4">
              {/* Order + status */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center
                                 text-xs font-bold text-gray-500">
                  {idx + 1}
                </span>
                {item.status === 'done'
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-1" />
                  : <Circle className="w-4 h-4 text-gray-200 mt-1" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {item.origin ? (ORIGIN_LABELS[item.origin] ?? item.origin) : 'Manual'}
                  </span>
                  {item.estimatedMinutes && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {item.estimatedMinutes}min
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>

                {item.description && (
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{item.description}</p>
                )}

                {/* Links to report/demand */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {item.report && (
                    <Link
                      href={`/reports/${item.report.id}`}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {item.report.title}
                    </Link>
                  )}
                  {item.demand && (
                    <Link
                      href={`/demandas/${item.demand.id}`}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {item.demand.title}
                    </Link>
                  )}
                </div>

                {/* Decision / notes if done */}
                {item.decisionMade && (
                  <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-green-700 mb-0.5">✅ Decisão registrada</p>
                    <p className="text-sm text-green-800 whitespace-pre-line">{item.decisionMade}</p>
                  </div>
                )}
                {item.notes && (
                  <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Anotações</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{item.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ata section placeholder */}
      {agenda.minutesText && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Ata da Reunião
          </h2>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {agenda.minutesText}
          </div>
        </div>
      )}
    </div>
  )
}
