import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove, isDirector } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Briefcase, Plus, CheckCircle2, Circle } from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  planned:     { label: 'Planejado',     cls: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'Em andamento',  cls: 'bg-amber-50 text-amber-700' },
  completed:   { label: 'Concluído',     cls: 'bg-green-50 text-green-700' },
  cancelled:   { label: 'Cancelado',     cls: 'bg-gray-100 text-gray-500' },
}

const RISK_META: Record<string, { label: string; dot: string }> = {
  low:      { label: 'Baixo',    dot: 'bg-green-400' },
  medium:   { label: 'Médio',    dot: 'bg-amber-400' },
  high:     { label: 'Alto',     dot: 'bg-orange-400' },
  critical: { label: 'Crítico',  dot: 'bg-red-500' },
}

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const dir    = isDirector(session.user.role)
  const status = searchParams.status ?? ''

  const projects = await prisma.project.findMany({
    where: {
      ...(!dir ? { responsibleId: session.user.id } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      responsibleUser: { select: { name: true } },
      milestones:  { select: { isCompleted: true } },
      _count:      { select: { demands: true, updates: true } },
    },
  })

  const STATUS_OPTIONS = [
    { value: '', label: 'Todos' },
    { value: 'planned', label: 'Planejados' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'completed', label: 'Concluídos' },
    { value: 'cancelled', label: 'Cancelados' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Projetos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestão de projetos e marcos de entrega
          </p>
        </div>
        <Link
          href="/projetos/novo"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo projeto
        </Link>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map((o) => (
          <Link
            key={o.value}
            href={o.value ? `/projetos?status=${o.value}` : '/projetos'}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              status === o.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum projeto encontrado</p>
          <Link href="/projetos/novo" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            Criar primeiro projeto →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const statusMeta = STATUS_META[p.status] ?? STATUS_META.planned
            const riskMeta   = RISK_META[p.riskLevel] ?? RISK_META.low
            const done       = p.milestones.filter((m) => m.isCompleted).length
            const total      = p.milestones.length
            const pct        = total > 0 ? Math.round((done / total) * 100) : null

            return (
              <Link
                key={p.id}
                href={`/projetos/${p.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all block"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <span className={`w-1.5 h-1.5 rounded-full ${riskMeta.dot}`} />
                        {riskMeta.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{p.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{p.responsibleUser.name}</p>
                  </div>
                </div>

                {/* Progresso de marcos */}
                {total > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="flex items-center gap-1">
                        {done === total
                          ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                          : <Circle className="w-3 h-3" />
                        }
                        {done}/{total} marcos
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${done === total ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex gap-3">
                    <span>{p._count.demands} demanda{p._count.demands !== 1 ? 's' : ''}</span>
                    <span>{p._count.updates} atualização{p._count.updates !== 1 ? 'ões' : ''}</span>
                  </div>
                  {p.expectedEndDate && (
                    <span>Entrega: {formatDate(p.expectedEndDate)}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
