import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { Plus, Calendar, CheckCircle2, Clock, Lightbulb, ArrowRight, Users, Building2, Globe } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  preparing: 'Preparando',
  scheduled: 'Agendada',
  done:      'Realizada',
  held:      'Realizada',
  finalized: 'Finalizada',
  cancelled: 'Cancelada',
}
const STATUS_COLORS: Record<string, string> = {
  draft:     'text-gray-500 bg-gray-100',
  preparing: 'text-amber-700 bg-amber-50',
  scheduled: 'text-blue-700 bg-blue-50',
  done:      'text-green-700 bg-green-50',
  held:      'text-green-700 bg-green-50',
  finalized: 'text-purple-700 bg-purple-50',
  cancelled: 'text-red-600 bg-red-50',
}

const TIPO_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  diretoria: { label: 'Diretoria',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <Users className="w-3 h-3" /> },
  interarea: { label: 'Interárea',   cls: 'bg-teal-50 text-teal-700 border-teal-200',       icon: <Building2 className="w-3 h-3" /> },
  externo:   { label: 'Ext.',        cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: <Globe className="w-3 h-3" /> },
}

type SP = { tipo?: string }

export default async function PautaPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const { tipo = '' } = searchParams

  const where: any = {}
  if (tipo) where.tipo = tipo

  const [agendas, suggestions] = await Promise.all([
    prisma.meetingAgenda.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.report.findMany({
      where: {
        status: 'published',
        agendaSuggestion: { not: null },
        agendaItems: { none: {} },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: {
        id: true, title: true, agendaSuggestion: true, publishedAt: true,
        area: { select: { name: true } },
        author: { select: { name: true } },
      },
    }),
  ])

  const scheduled = agendas.filter((a) => ['scheduled', 'preparing'].includes(a.status))
  const past      = agendas.filter((a) => !['scheduled', 'preparing'].includes(a.status))

  function buildHref(params: Record<string, string>) {
    const merged = { tipo, ...params }
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/pauta${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pauta de Reuniões</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie pautas e registros de reuniões</p>
        </div>
        <Link
          href="/pauta/nova"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Pauta
        </Link>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1.5 flex-wrap">
        <Link href={buildHref({ tipo: '' })} className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${!tipo ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
          Todas
        </Link>
        {Object.entries(TIPO_META).map(([key, m]) => (
          <Link key={key} href={buildHref({ tipo: key })}
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${tipo === key ? 'bg-gray-800 text-white border-gray-800' : `${m.cls} hover:opacity-80`}`}>
            {m.icon} {m.label}
          </Link>
        ))}
      </div>

      {/* Sugestões de pauta vindas de reports */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Sugestões de Pauta — pendentes ({suggestions.length})
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl divide-y divide-amber-100">
            {suggestions.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{r.area.name}</span>
                    <span className="text-xs text-amber-600">por {r.author.name}</span>
                    <span className="text-xs text-amber-500">{r.publishedAt ? timeAgo(new Date(r.publishedAt)) : ''}</span>
                  </div>
                  <p className="text-sm font-medium text-amber-900">{r.title}</p>
                  <p className="text-xs text-amber-700 mt-0.5 line-clamp-2">{r.agendaSuggestion}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={`/reports/${r.id}`} className="text-xs text-amber-700 hover:text-amber-900 underline">Ver report</Link>
                  <Link
                    href={`/pauta/nova?reportId=${r.id}&suggestion=${encodeURIComponent(r.agendaSuggestion ?? '')}&title=${encodeURIComponent(r.title)}`}
                    className="inline-flex items-center gap-1 text-xs text-white bg-amber-600 hover:bg-amber-700 px-2 py-1 rounded-lg transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" /> Incluir em pauta
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Próximas */}
      {scheduled.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Próximas Reuniões
          </h2>
          <div className="space-y-3">
            {scheduled.map((a) => <AgendaCard key={a.id} agenda={a} />)}
          </div>
        </section>
      )}

      {/* Histórico */}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Histórico
          </h2>
          <div className="space-y-2">
            {past.map((a) => <AgendaCard key={a.id} agenda={a} compact />)}
          </div>
        </section>
      )}

      {agendas.length === 0 && suggestions.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma pauta ainda</p>
          <p className="text-sm text-gray-400 mt-1">Crie uma nova pauta para organizar a próxima reunião</p>
          <Link href="/pauta/nova" className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Nova Pauta
          </Link>
        </div>
      )}
    </div>
  )
}

function AgendaCard({ agenda, compact = false }: { agenda: any; compact?: boolean }) {
  const statusCls = STATUS_COLORS[agenda.status] ?? 'text-gray-500 bg-gray-100'
  const tipoMeta  = TIPO_META[agenda.tipo as keyof typeof TIPO_META] ?? TIPO_META.diretoria
  return (
    <Link href={`/pauta/${agenda.id}`} className="block bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>{STATUS_LABELS[agenda.status] ?? agenda.status}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${tipoMeta.cls}`}>
                {tipoMeta.icon} {tipoMeta.label}
              </span>
              {agenda.scheduledAt && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
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
              {agenda._count.items} item{agenda._count.items !== 1 ? 's' : ''} · {agenda.createdBy.name} · {timeAgo(new Date(agenda.createdAt))}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
