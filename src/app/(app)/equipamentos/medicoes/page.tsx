import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { Receipt, Plus, ChevronRight, CheckCircle2, Clock, AlertTriangle, XCircle, CreditCard, FileText } from 'lucide-react'
import { FiltroSelect } from '@/components/frota/FiltroSelect'

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  rascunho:    { label: 'Rascunho',    cls: 'bg-gray-100 text-gray-600 border-gray-200',       icon: Clock },
  enviada:     { label: 'Aguard. aprovação', cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: AlertTriangle },
  aprovada:    { label: 'Aprovada',    cls: 'bg-blue-50 text-blue-700 border-blue-200',         icon: CheckCircle2 },
  guia_gerada: { label: 'Guia gerada', cls: 'bg-purple-50 text-purple-700 border-purple-200',   icon: FileText },
  paga:        { label: 'Paga',        cls: 'bg-green-50 text-green-700 border-green-200',      icon: CreditCard },
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type SP = { status?: string; contratoId?: string; ano?: string }

export default async function EquipamentosMedicoesPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const { status = '', contratoId = '', ano = '' } = searchParams
  const anoAtual = new Date().getFullYear()

  const where: any = { moduloTipo: 'equipamento' }
  if (status)     where.status     = status
  if (contratoId) where.contratoId = contratoId
  if (ano)        where.competenciaAno = Number(ano)

  const [medicoes, contratos, contadores] = await Promise.all([
    prisma.medicaoLocacao.findMany({
      where,
      orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
      include: {
        contrato:  { select: { id: true, number: true, name: true } },
        aprovador: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count:    { select: { itens: true } },
      },
    }),
    prisma.contract.findMany({
      where: { status: 'active' },
      select: { id: true, number: true, name: true },
      orderBy: { number: 'asc' },
    }),
    prisma.medicaoLocacao.groupBy({
      by: ['status'],
      where: { moduloTipo: 'equipamento' },
      _count: { status: true },
    }),
  ])

  const countByStatus = Object.fromEntries(contadores.map((c) => [c.status, c._count.status]))
  const total = Object.values(countByStatus).reduce((a, b) => a + b, 0)

  const totalFaturado = medicoes.filter((m) => m.status === 'paga').reduce((acc, m) => acc + m.totalGeral, 0)
  const totalPendente = medicoes.filter((m) => ['aprovada', 'guia_gerada'].includes(m.status)).reduce((acc, m) => acc + m.totalGeral, 0)

  function buildHref(params: Record<string, string>) {
    const merged = { status, contratoId, ano, ...params }
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/equipamentos/medicoes${qs ? `?${qs}` : ''}`
  }

  const canGestor = ['master', 'admin', 'manager'].includes(session.user.role)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Medições de Locação
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Faturamento mensal de equipamentos — CDG RENTAL</p>
        </div>
        {canGestor && (
          <Link href="/equipamentos/medicoes/nova" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Nova medição
          </Link>
        )}
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, cls: 'text-gray-900' },
          { label: 'Aguardando', value: countByStatus.enviada ?? 0, cls: countByStatus.enviada ? 'text-amber-600' : 'text-gray-400' },
          { label: 'Faturado (pagas)', value: totalFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cls: 'text-green-600' },
          { label: 'Pendente cobrança', value: totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cls: 'text-purple-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-400">{kpi.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${kpi.cls}`}>{kpi.value}</p>
          </div>
        ))}
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

      {/* Filtros secundários */}
      <div className="flex gap-3 flex-wrap">
        <FiltroSelect
          paramName="contratoId"
          value={contratoId}
          otherParams={{ status, ano }}
          baseHref="/equipamentos/medicoes"
          placeholder="Todos os contratos"
          options={contratos.map((c) => ({ value: c.id, label: `${c.number} — ${c.name}` }))}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <FiltroSelect
          paramName="ano"
          value={ano}
          otherParams={{ status, contratoId }}
          baseHref="/equipamentos/medicoes"
          placeholder="Todos os anos"
          options={[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => ({ value: String(a), label: String(a) }))}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      {medicoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma medição encontrada</p>
          {canGestor && <Link href="/equipamentos/medicoes/nova" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Criar primeira medição →</Link>}
        </div>
      ) : (
        <div className="space-y-2">
          {medicoes.map((m) => {
            const meta = STATUS_META[m.status] ?? STATUS_META.rascunho
            const StatusIcon = meta.icon
            const mesLabel = MESES[(m.competenciaMes - 1)] ?? ''
            const urgente  = m.status === 'enviada'

            return (
              <Link
                key={m.id}
                href={`/equipamentos/medicoes/${m.id}`}
                className={`bg-white rounded-xl border p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all ${urgente ? 'border-amber-200' : 'border-gray-200'}`}
              >
                {/* Competência */}
                <div className="w-14 text-center flex-shrink-0">
                  <p className="text-xs text-gray-400">{m.competenciaAno}</p>
                  <p className="text-lg font-bold text-gray-900">{mesLabel}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 truncate">{m.contrato.number} — {m.contrato.name}</p>
                  <p className="text-xs text-gray-400">{m._count.itens} ativo{m._count.itens !== 1 ? 's' : ''} · criado por {m.createdBy.name}{m.aprovador ? ` · aprovado por ${m.aprovador.name}` : ''}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">{m.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
