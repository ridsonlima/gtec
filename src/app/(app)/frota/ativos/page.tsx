import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { Truck, Search, LayoutList } from 'lucide-react'
import { NovoAtivoModal } from '@/components/frota/NovoAtivoModal'
import { TabelaAtivos } from '@/components/frota/TabelaAtivos'
import { PainelAcumulado } from '@/components/frota/PainelAcumulado'

type SP = { status?: string; search?: string }

export default async function FrotaAtivosPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const { status = '', search = '' } = searchParams

  const where: any = { tipo: 'veiculo' }
  if (status) where.status = status
  if (search) {
    where.OR = [
      { tag:       { contains: search, mode: 'insensitive' } },
      { descricao: { contains: search, mode: 'insensitive' } },
      { placa:     { contains: search, mode: 'insensitive' } },
      { marca:     { contains: search, mode: 'insensitive' } },
      { modelo:    { contains: search, mode: 'insensitive' } },
    ]
  }

  const [ativos, contadores] = await Promise.all([
    prisma.ativo.findMany({
      where,
      orderBy: [{ status: 'asc' }, { tag: 'asc' }],
      include: {
        alocacoes: {
          where: { dataFim: null },
          include: {
            contrato: { select: { id: true, number: true, name: true } },
            projeto:  { select: { name: true } },
          },
          take: 1,
        },
        medicaoItens: {
          orderBy: [
            { medicao: { competenciaAno: 'desc' } },
            { medicao: { competenciaMes: 'desc' } },
          ] as any,
          take: 1,
          select: { medicao: { select: { competenciaAno: true, competenciaMes: true } } },
        },
        _count: {
          select: {
            ordensServico: { where: { status: { in: ['aberta', 'em_execucao'] } } },
          },
        },
      },
    }),
    prisma.ativo.groupBy({
      by: ['status'],
      where: { tipo: 'veiculo' },
      _count: { status: true },
    }),
  ])

  const countByStatus = Object.fromEntries(contadores.map((c) => [c.status, c._count.status]))
  const total = Object.values(countByStatus).reduce((a, b) => a + b, 0)

  const STATUS_FILTROS = [
    { value: '', label: 'Todos', count: total },
    { value: 'disponivel', label: 'Disponíveis', count: countByStatus.disponivel ?? 0 },
    { value: 'alocado',    label: 'Alocados',    count: countByStatus.alocado ?? 0 },
    { value: 'manutencao', label: 'Manutenção',  count: countByStatus.manutencao ?? 0 },
    { value: 'inativo',    label: 'Inativos',    count: countByStatus.inativo ?? 0 },
  ]

  const canEdit = ['master', 'admin', 'manager'].includes(session.user.role)

  // Calcula acumulado para o painel
  const itensAcumulados = ativos
    .filter((a) => a.status === 'alocado' && a.alocacoes[0])
    .map((a) => {
      const aloc    = a.alocacoes[0]
      const ultima  = a.medicaoItens[0]?.medicao
      let desde: Date
      if (ultima) {
        desde = new Date(ultima.competenciaAno, ultima.competenciaMes, 1)
        const inicioAloc = new Date(aloc.dataInicio)
        if (inicioAloc > desde) desde = inicioAloc
      } else {
        desde = new Date(aloc.dataInicio)
      }
      const dias     = Math.max(0, Math.floor((Date.now() - desde.getTime()) / 86400000))
      const valorDia = a.valorLocacaoMensal / 30
      return {
        id: a.id, tag: a.tag, descricao: a.descricao, categoria: a.categoria,
        contratoNumber: aloc.contrato.number, contratoName: aloc.contrato.name,
        dataInicio: aloc.dataInicio,
        diasAcumulados: dias, valorDia, estimado: Number((dias * valorDia).toFixed(2)),
      }
    })

  function buildHref(params: Record<string, string>) {
    const merged = { status, search, ...params }
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/frota/ativos${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Veículos — Frota CDG RENTAL
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de veículos locados às obras do grupo</p>
        </div>
        <div className="flex items-center gap-2">
          <PainelAcumulado itens={itensAcumulados} tipo="veiculo" />
          <Link
            href="/frota/por-contrato"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LayoutList className="w-4 h-4" /> Por contrato
          </Link>
          {canEdit && <NovoAtivoModal defaultTipo="veiculo" />}
        </div>
      </div>

      {/* Contadores de status + busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTROS.map((f) => (
            <Link
              key={f.value}
              href={buildHref({ status: f.value })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                status === f.value
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${status === f.value ? 'bg-white/20' : 'bg-gray-100'}`}>
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        <form method="GET" action="/frota/ativos" className="relative flex-shrink-0">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            name="search"
            defaultValue={search}
            placeholder="TAG, placa, descrição…"
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </form>
      </div>

      {/* Tabela */}
      {ativos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum veículo encontrado</p>
          {!status && !search && canEdit && (
            <p className="text-xs text-gray-400 mt-1">Use o botão "Novo ativo" para cadastrar o primeiro</p>
          )}
        </div>
      ) : (
        <TabelaAtivos ativos={ativos} canEdit={canEdit} tipo="veiculo" baseHref="/frota/ativos" />
      )}
    </div>
  )
}
