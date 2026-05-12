import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { Plus, Calendar, CheckCircle2, Clock } from 'lucide-react'

const AGENDA_STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  scheduled: 'Agendada',
  done:      'Realizada',
  cancelled: 'Cancelada',
}
const AGENDA_STATUS_COLORS: Record<string, string> = {
  draft:     'text-gray-500 bg-gray-100',
  scheduled: 'text-blue-700 bg-blue-50',
  done:      'text-green-700 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
}

export default async function PautaPage() {
  const session = await auth()
  if (!session) return null

  // Only directors and admins can access agenda
  if (!isDirector(session.user.role)) redirect('/dashboard')

  const agendas = await prisma.meetingAgenda.findMany({
    orderBy: { scheduledAt: 'desc' },
    take: 20,
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  })

  const scheduled = agendas.filter((a) => a.status === 'scheduled')
  const past      = agendas.filter((a) => a.status !== 'scheduled')

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pauta de Reuniões</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gerencie pautas e registros de reuniões da diretoria
          </p>
        </div>
        <Link
          href="/pauta/nova"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white
                     text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Pauta
        </Link>
      </div>

      {/* Upcoming */}
      {scheduled.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Agendadas
          </h2>
          <div className="space-y-3">
            {scheduled.map((a) => (
              <AgendaCard key={a.id} agenda={a} />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Histórico
          </h2>
          <div className="space-y-2">
            {past.map((a) => (
              <AgendaCard key={a.id} agenda={a} compact />
            ))}
          </div>
        </section>
      )}

      {agendas.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma pauta ainda</p>
          <p className="text-sm text-gray-400 mt-1">
            Crie uma nova pauta para organizar a próxima reunião
          </p>
          <Link
            href="/pauta/nova"
            className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 bg-blue-600 text-white
                       text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Pauta
          </Link>
        </div>
      )}
    </div>
  )
}

function AgendaCard({
  agenda,
  compact = false,
}: {
  agenda: any
  compact?: boolean
}) {
  const statusColor = AGENDA_STATUS_COLORS[agenda.status] ?? 'text-gray-500 bg-gray-100'
  const statusLabel = AGENDA_STATUS_LABELS[agenda.status] ?? agenda.status

  return (
    <Link
      href={`/pauta/${agenda.id}`}
      className="block bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow"
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                {statusLabel}
              </span>
              {agenda.scheduledAt && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(agenda.scheduledAt)}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900">{agenda.title}</p>
            {!compact && agenda.objective && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{agenda.objective}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {agenda._count.items} item{agenda._count.items !== 1 ? 's' : ''} ·
              criado por {agenda.createdBy.name} · {timeAgo(new Date(agenda.createdAt))}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
