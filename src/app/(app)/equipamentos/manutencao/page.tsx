import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { OSAcoesInline } from '@/components/frota/OSAcoesInline'
import { NovaOSListModal } from '@/components/frota/NovaOSListModal'
import { Wrench, CheckCircle2, Clock, Play, XCircle, AlertTriangle, ChevronRight } from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  aberta:       { label: 'Aberta',       cls: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock },
  em_execucao:  { label: 'Em execução',  cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Play },
  concluida:    { label: 'Concluída',    cls: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2 },
  cancelada:    { label: 'Cancelada',    cls: 'bg-red-50 text-red-600 border-red-200',          icon: XCircle },
}

type SP = { status?: string; tipo?: string }

export default async function EquipamentosManutencaoPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const { status = '', tipo = '' } = searchParams

  const where: any = { ativo: { tipo: 'equipamento' } }
  if (status) where.status = status
  if (tipo)   where.tipo   = tipo

  const [ordens, todasOrdens] = await Promise.all([
    prisma.ordemServico.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dataAbertura: 'desc' }],
      include: {
        ativo:     { select: { id: true, tag: true, descricao: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.ordemServico.findMany({
      where: { ativo: { tipo: 'equipamento' } },
      select: { status: true },
    }),
  ])

  const countByStatus = todasOrdens.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})
  const total = todasOrdens.length
  const hoje = new Date()

  const canGestor = ['master', 'admin', 'manager'].includes(session.user.role)

  function buildHref(params: Record<string, string>) {
    const merged = { status, tipo, ...params }
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/equipamentos/manutencao${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Manutenção
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">OS de equipamentos — CDG RENTAL</p>
        </div>
        {canGestor && <NovaOSListModal moduloTipo="equipamento" />}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, cls: 'text-gray-900' },
          { label: 'Abertas', value: countByStatus.aberta ?? 0, cls: countByStatus.aberta ? 'text-amber-600' : 'text-gray-400' },
          { label: 'Em execução', value: countByStatus.em_execucao ?? 0, cls: countByStatus.em_execucao ? 'text-blue-600' : 'text-gray-400' },
          { label: 'Concluídas', value: countByStatus.concluida ?? 0, cls: 'text-green-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-400">{kpi.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${kpi.cls}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros status */}
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

      {/* Filtro tipo */}
      <div className="flex gap-1.5">
        <Link href={buildHref({ tipo: '' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!tipo ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
          Todos os tipos
        </Link>
        <Link href={buildHref({ tipo: 'preventiva' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${tipo === 'preventiva' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'}`}>
          Preventiva
        </Link>
        <Link href={buildHref({ tipo: 'corretiva' })} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${tipo === 'corretiva' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:border-red-400'}`}>
          Corretiva
        </Link>
      </div>

      {/* Lista */}
      {ordens.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma OS encontrada</p>
          <p className="text-xs text-gray-300 mt-1">Abra uma OS pela ficha do ativo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordens.map((os) => {
            const meta = STATUS_META[os.status] ?? STATUS_META.aberta
            const StatusIcon = meta.icon
            const vencida = os.dataPrevista && new Date(os.dataPrevista) < hoje && !['concluida', 'cancelada'].includes(os.status)
            const isCorretiva = os.tipo === 'corretiva'

            return (
              <div
                key={os.id}
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-all ${vencida ? 'border-red-200' : isCorretiva && !['concluida', 'cancelada'].includes(os.status) ? 'border-red-100' : 'border-gray-200'}`}
              >
                {/* Tipo badge */}
                <div className={`flex-shrink-0 w-2 self-stretch rounded-full ${isCorretiva ? 'bg-red-400' : 'bg-blue-400'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isCorretiva ? 'text-red-600' : 'text-blue-600'}`}>
                      {os.tipo}
                    </span>
                    {vencida && (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Vencida
                      </span>
                    )}
                  </div>

                  <p className="font-medium text-gray-900">
                    <Link href={`/equipamentos/ativos/${os.ativo.id}`} className="hover:underline">{os.ativo.tag}</Link>
                    {' '}<span className="font-normal text-gray-500">·</span>{' '}
                    <span className="font-normal text-gray-700">{os.descricao}</span>
                  </p>

                  <p className="text-xs text-gray-400 mt-0.5">
                    Aberta em {new Date(os.dataAbertura).toLocaleDateString('pt-BR')}
                    {os.dataPrevista && ` · prevista ${new Date(os.dataPrevista).toLocaleDateString('pt-BR')}`}
                    {os.executante && ` · ${os.executante}`}
                    {os.custo != null && ` · ${os.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  </p>
                </div>

                {/* Ações inline */}
                {canGestor && !['concluida', 'cancelada'].includes(os.status) && (
                  <div className="flex-shrink-0">
                    <OSAcoesInline osId={os.id} status={os.status as any} role={session.user.role} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
