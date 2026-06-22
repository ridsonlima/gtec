import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Gavel, Search, CalendarDays, FileText, ClipboardList, ChevronRight } from 'lucide-react'

type SP = { q?: string }

export default async function DecisoesPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const q = (searchParams.q ?? '').trim()

  const where: any = { decisionMade: { not: null } }
  if (q) {
    where.OR = [
      { decisionMade: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
    ]
  }

  const itens = await prisma.agendaItem.findMany({
    where,
    include: {
      agenda: { select: { id: true, title: true, meetingDate: true, status: true } },
      report: { select: { id: true, title: true } },
      demand: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Ordena por data da reunião (mais recente primeiro), com fallback para createdAt
  const decisoes = itens.sort((a, b) => {
    const da = a.agenda.meetingDate ? new Date(a.agenda.meetingDate).getTime() : new Date(a.createdAt).getTime()
    const db = b.agenda.meetingDate ? new Date(b.agenda.meetingDate).getTime() : new Date(b.createdAt).getTime()
    return db - da
  })

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="w-5 h-5" /> Decisões
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Histórico corporativo de decisões tomadas nas reuniões. A memória oficial da empresa.</p>
      </div>

      {/* Sub-navegação: Reuniões | Decisões */}
      <div className="flex gap-1 border-b border-gray-200">
        <Link href="/pauta" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors">
          Reuniões
        </Link>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-700">
          Decisões
        </span>
      </div>

      {/* Busca */}
      <form method="GET" action="/decisoes" className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por decisão ou assunto…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {/* Lista */}
      {decisoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Gavel className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{q ? 'Nenhuma decisão encontrada para essa busca' : 'Nenhuma decisão registrada ainda'}</p>
          {!q && <p className="text-xs text-gray-400 mt-1">As decisões aparecem aqui quando itens de pauta são concluídos com uma decisão.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {decisoes.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
              {/* Decisão (destaque) */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Gavel className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">{d.decisionMade}</p>
                  <p className="text-xs text-gray-500 mt-1">Assunto: {d.title}</p>

                  {d.notes && <p className="text-xs text-gray-500 mt-1 italic">"{d.notes}"</p>}

                  {/* Contexto */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                    <Link href={`/pauta/${d.agenda.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <ClipboardList className="w-3.5 h-3.5" /> {d.agenda.title}
                    </Link>
                    {d.agenda.meetingDate && (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <CalendarDays className="w-3.5 h-3.5" /> {formatDate(d.agenda.meetingDate)}
                      </span>
                    )}
                    {d.demand && (
                      <Link href={`/demandas/${d.demand.id}`} className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600">
                        <ChevronRight className="w-3 h-3" /> Demanda
                      </Link>
                    )}
                    {d.report && (
                      <Link href={`/reports/${d.report.id}`} className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600">
                        <FileText className="w-3.5 h-3.5" /> Report
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
