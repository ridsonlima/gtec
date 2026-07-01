import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canViewRental } from '@/lib/permissions'
import Link from 'next/link'
import {
  ClipboardCheck, Plus, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, XCircle, Play, Calendar,
} from 'lucide-react'
import { FiltroSelect } from '@/components/frota/FiltroSelect'
import { TipoSwitcher } from '@/components/frota/TipoSwitcher'

type Tipo = 'veiculo' | 'equipamento'
type SP = { status?: string; contratoId?: string }

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  agendada:    { label: 'Agendada',    cls: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock },
  em_andamento:{ label: 'Em andamento',cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Play },
  concluida:   { label: 'Concluída',   cls: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',   cls: 'bg-red-50 text-red-600 border-red-200',          icon: XCircle },
}

const CONFIG = {
  veiculo:     { base: '/frota',        subtitulo: 'Visitas de campo da frota de veículos — CDG RENTAL' },
  equipamento: { base: '/equipamentos', subtitulo: 'Visitas de campo de equipamentos — CDG RENTAL' },
} as const

export async function AuditoriasListView({ tipo, searchParams }: { tipo: Tipo; searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!canViewRental(session)) redirect('/dashboard')

  const cfg = CONFIG[tipo]
  const { status = '', contratoId = '' } = searchParams

  const where: any = { moduloTipo: tipo }
  if (status)     where.status     = status
  if (contratoId) where.contratoId = contratoId

  const [visitas, contratos, contadores, pendenciasAbertas] = await Promise.all([
    prisma.auditoriaVisita.findMany({
      where,
      orderBy: { dataVisita: 'desc' },
      include: {
        auditor:  { select: { name: true } },
        contrato: { select: { number: true, name: true } },
        projeto:  { select: { name: true } },
        _count:   { select: { itens: true } },
      },
    }),
    prisma.contract.findMany({
      where: { status: 'active' },
      select: { id: true, number: true, name: true },
      orderBy: { number: 'asc' },
    }),
    prisma.auditoriaVisita.groupBy({
      by: ['status'],
      where: { moduloTipo: tipo },
      _count: { status: true },
    }),
    prisma.pendenciaAuditoria.count({ where: { status: { in: ['aberta', 'em_tratativa'] }, visita: { moduloTipo: tipo } } }),
  ])

  const countByStatus = Object.fromEntries(contadores.map((c) => [c.status, c._count.status]))
  const total = Object.values(countByStatus).reduce((a, b) => a + b, 0)
  const canGestor = ['master', 'admin', 'manager', 'supervisor'].includes(session.user.role)

  function buildHref(params: Record<string, string>) {
    const merged = { status, contratoId, ...params }
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `${cfg.base}/auditorias${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <TipoSwitcher tipo={tipo} func="auditorias" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Auditorias de Campo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{cfg.subtitulo}</p>
        </div>
        {canGestor && (
          <Link href={`${cfg.base}/auditorias/nova`} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-colors">
            <Plus className="w-4 h-4" /> Agendar visita
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de visitas', value: total, cls: 'text-gray-900' },
          { label: 'Em andamento', value: countByStatus.em_andamento ?? 0, cls: countByStatus.em_andamento ? 'text-blue-600' : 'text-gray-400' },
          { label: 'Agendadas', value: countByStatus.agendada ?? 0, cls: countByStatus.agendada ? 'text-amber-600' : 'text-gray-400' },
          { label: 'Pendências abertas', value: pendenciasAbertas, cls: pendenciasAbertas > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-400">{kpi.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${kpi.cls}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Alerta pendências */}
      {pendenciasAbertas > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">
              <span className="font-semibold">{pendenciasAbertas} pendência{pendenciasAbertas !== 1 ? 's' : ''}</span> abertas aguardando resolução
            </p>
          </div>
          <Link href={`${cfg.base}/auditorias/pendencias`} className="text-xs text-red-700 font-medium hover:underline flex-shrink-0">
            Ver todas →
          </Link>
        </div>
      )}

      {/* Filtros */}
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

      {/* Filtro contrato */}
      <div>
        <FiltroSelect
          paramName="contratoId"
          value={contratoId}
          otherParams={{ status }}
          baseHref={`${cfg.base}/auditorias`}
          placeholder="Todos os contratos"
          options={contratos.map((c) => ({ value: c.id, label: `${c.number} — ${c.name}` }))}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      {visitas.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma visita encontrada</p>
          {canGestor && (
            <Link href={`${cfg.base}/auditorias/nova`} className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              Agendar primeira visita →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visitas.map((v) => {
            const meta = STATUS_META[v.status] ?? STATUS_META.agendada
            const StatusIcon = meta.icon
            const dataVisita = new Date(v.dataVisita)
            const hoje = new Date()
            const vencida = v.status === 'agendada' && dataVisita < hoje

            return (
              <Link
                key={v.id}
                href={`${cfg.base}/auditorias/${v.id}`}
                className={`bg-white rounded-xl border p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all ${vencida ? 'border-amber-200' : 'border-gray-200'}`}
              >
                {/* Data */}
                <div className="w-14 text-center flex-shrink-0">
                  <p className="text-xs text-gray-400">{dataVisita.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</p>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{dataVisita.getDate()}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    {vencida && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Vencida
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 truncate">
                    {v.contrato ? `${v.contrato.number} — ${v.contrato.name}` : v.projeto?.name ?? 'Sem contrato/projeto'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Auditor: {v.auditor.name} · {v._count.itens} item{v._count.itens !== 1 ? 'ns' : ''} inspecionado{v._count.itens !== 1 ? 's' : ''}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Link pendências */}
      <div className="flex justify-center">
        <Link
          href={`${cfg.base}/auditorias/pendencias`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
        >
          <Calendar className="w-4 h-4" /> Ver todas as pendências
        </Link>
      </div>
    </div>
  )
}
