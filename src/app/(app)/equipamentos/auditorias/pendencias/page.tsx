import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canViewRental } from '@/lib/permissions'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, ChevronRight } from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberta:       { label: 'Aberta',        cls: 'bg-red-50 text-red-700 border-red-200' },
  em_tratativa: { label: 'Em tratativa',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolvida:    { label: 'Resolvida',     cls: 'bg-green-50 text-green-700 border-green-200' },
  reincidente:  { label: 'Reincidente',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
}

const SEV_META: Record<string, { label: string; dot: string }> = {
  atencao: { label: 'Atenção', dot: 'bg-amber-400' },
  critica: { label: 'Crítica', dot: 'bg-red-500' },
}

type SP = { status?: string; severidade?: string }

export default async function EquipamentosPendenciasPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!canViewRental(session)) redirect('/dashboard')

  const { status = '', severidade = '' } = searchParams

  const where: any = {}
  if (status)     where.status     = status
  if (severidade) where.severidade = severidade

  const [pendencias, contadores] = await Promise.all([
    prisma.pendenciaAuditoria.findMany({
      where,
      orderBy: [{ severidade: 'desc' }, { prazo: 'asc' }],
      include: {
        visita:      { select: { id: true, dataVisita: true, contrato: { select: { number: true, name: true } } } },
        responsavel: { select: { name: true } },
        item:        { select: { descricao: true, ativo: { select: { tag: true } } } },
      },
    }),
    prisma.pendenciaAuditoria.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ])

  const countByStatus = Object.fromEntries(contadores.map((c) => [c.status, c._count.status]))
  const total = Object.values(countByStatus).reduce((a, b) => a + b, 0)
  const hoje = new Date()

  function buildHref(params: Record<string, string>) {
    const merged = { status, severidade, ...params }
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/equipamentos/auditorias/pendencias${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link href="/equipamentos/auditorias" className="mt-1 p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Pendências de Auditoria
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Não conformidades detectadas nas visitas de campo</p>
        </div>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-1.5 flex-wrap">
        <Link href={buildHref({ status: '' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!status ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
          Todas ({total})
        </Link>
        {Object.entries(STATUS_META).map(([s, m]) => (
          <Link key={s} href={buildHref({ status: s })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${status === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            {m.label} {countByStatus[s] ? `(${countByStatus[s]})` : ''}
          </Link>
        ))}
      </div>

      {/* Filtro severidade */}
      <div className="flex gap-1.5">
        <Link href={buildHref({ severidade: '' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!severidade ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
          Todas severidades
        </Link>
        <Link href={buildHref({ severidade: 'critica' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${severidade === 'critica' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:border-red-400'}`}>
          Crítica
        </Link>
        <Link href={buildHref({ severidade: 'atencao' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${severidade === 'atencao' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400'}`}>
          Atenção
        </Link>
      </div>

      {/* Lista */}
      {pendencias.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma pendência encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendencias.map((p) => {
            const stt = STATUS_META[p.status] ?? STATUS_META.aberta
            const sev = SEV_META[p.severidade] ?? SEV_META.atencao
            const vencida = p.prazo && new Date(p.prazo) < hoje && p.status !== 'resolvida'

            return (
              <Link
                key={p.id}
                href={`/equipamentos/auditorias/pendencias/${p.id}`}
                className={`bg-white rounded-xl border p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all ${vencida ? 'border-red-200' : 'border-gray-200'}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${sev.dot}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${stt.cls}`}>
                      {stt.label}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{sev.label}</span>
                    {vencida && (
                      <span className="text-xs font-medium text-red-600 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> Vencida
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{p.descricao}</p>
                  <p className="text-xs text-gray-400">
                    {p.item?.ativo.tag && `${p.item.ativo.tag} · `}
                    {p.visita.contrato ? `${p.visita.contrato.number} · ` : ''}
                    {new Date(p.visita.dataVisita).toLocaleDateString('pt-BR')}
                    {p.responsavel && ` · ${p.responsavel.name}`}
                    {p.prazo && ` · prazo ${new Date(p.prazo).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
