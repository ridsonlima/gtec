import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canViewRental } from '@/lib/permissions'
import Link from 'next/link'
import { Truck, Package, Search, LayoutList } from 'lucide-react'
import { NovoAtivoModal } from './NovoAtivoModal'
import { ImportarAtivosButton } from './ImportarAtivosButton'
import { CondutoresButton } from './CondutoresButton'
import { TabelaAtivos } from './TabelaAtivos'
import { PainelAcumulado } from './PainelAcumulado'
import { TipoSwitcher } from './TipoSwitcher'

type Tipo = 'veiculo' | 'equipamento'
type SP = { status?: string; search?: string }

const CONFIG = {
  veiculo: {
    icon: Truck,
    titulo: 'Veículos — Frota CDG RENTAL',
    subtitulo: 'Gestão de veículos locados às obras do grupo',
    base: '/frota',
    vazio: 'Nenhum veículo encontrado',
    novoHint: 'Use o botão "Novo ativo" para cadastrar o primeiro',
    placeholder: 'TAG, placa, descrição…',
    ring: 'focus:ring-blue-500',
    searchFields: ['tag', 'descricao', 'placa', 'marca', 'modelo'],
  },
  equipamento: {
    icon: Package,
    titulo: 'Equipamentos — CDG RENTAL',
    subtitulo: 'Gestão de equipamentos locados às obras do grupo',
    base: '/equipamentos',
    vazio: 'Nenhum equipamento encontrado',
    novoHint: 'Use o botão "Novo equipamento" para cadastrar o primeiro',
    placeholder: 'TAG, nº série, descrição…',
    ring: 'focus:ring-amber-500',
    searchFields: ['tag', 'descricao', 'numeroserie', 'marca', 'modelo'],
  },
} as const

export async function AtivosListView({ tipo, searchParams }: { tipo: Tipo; searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!canViewRental(session)) redirect('/dashboard')

  const cfg = CONFIG[tipo]
  const Icon = cfg.icon
  const { status = '', search = '' } = searchParams

  const where: any = { tipo }
  if (status) where.status = status
  if (search) {
    where.OR = cfg.searchFields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }))
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
      where: { tipo },
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

  const canEdit = ['master', 'admin', 'manager', 'supervisor'].includes(session.user.role)

  const itensAcumulados = ativos
    .filter((a) => a.status === 'alocado' && a.alocacoes[0])
    .map((a) => {
      const aloc   = a.alocacoes[0]
      const ultima = a.medicaoItens[0]?.medicao
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
    return `${cfg.base}/ativos${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <TipoSwitcher tipo={tipo} func="ativos" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {cfg.titulo}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{cfg.subtitulo}</p>
        </div>
        <div className="flex items-center gap-2">
          <PainelAcumulado itens={itensAcumulados} tipo={tipo} />
          <Link
            href={`${cfg.base}/por-contrato`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LayoutList className="w-4 h-4" /> Por contrato
          </Link>
          {canEdit && tipo === 'veiculo' && <CondutoresButton />}
          {canEdit && <ImportarAtivosButton tipo={tipo} />}
          {canEdit && <NovoAtivoModal defaultTipo={tipo} />}
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

        <form method="GET" action={`${cfg.base}/ativos`} className="relative flex-shrink-0">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            name="search"
            defaultValue={search}
            placeholder={cfg.placeholder}
            className={`pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 ${cfg.ring} w-52`}
          />
        </form>
      </div>

      {/* Tabela */}
      {ativos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{cfg.vazio}</p>
          {!status && !search && canEdit && (
            <p className="text-xs text-gray-400 mt-1">{cfg.novoHint}</p>
          )}
        </div>
      ) : (
        <TabelaAtivos ativos={ativos} canEdit={canEdit} tipo={tipo} baseHref={`${cfg.base}/ativos`} />
      )}
    </div>
  )
}
