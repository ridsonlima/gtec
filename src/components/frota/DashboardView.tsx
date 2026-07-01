import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canViewRental } from '@/lib/permissions'
import { Gauge, Truck, Package, AlertTriangle, Wrench, ClipboardCheck, Receipt } from 'lucide-react'
import Link from 'next/link'
import { TipoSwitcher } from '@/components/frota/TipoSwitcher'

type Tipo = 'veiculo' | 'equipamento'

const CONFIG = {
  veiculo: {
    base: '/frota',
    icon: Truck,
    titulo: 'Dashboard — Frota CDG RENTAL',
    subtitulo: 'Visão geral dos veículos, manutenção e faturamento',
    accentBorder: 'hover:border-blue-300',
    cardAccent: 'text-blue-600',
    labelAtivos: 'Veículos ativos',
    cardAtivosTitulo: 'Veículos',
    cardAtivosDesc: 'Cadastro, alocação e histórico da frota de veículos',
    cardAuditDesc: 'Visitas de campo semanais e controle de pendências',
  },
  equipamento: {
    base: '/equipamentos',
    icon: Package,
    titulo: 'Dashboard — Equipamentos CDG RENTAL',
    subtitulo: 'Visão geral dos equipamentos, manutenção e faturamento',
    accentBorder: 'hover:border-amber-300',
    cardAccent: 'text-amber-600',
    labelAtivos: 'Equipamentos ativos',
    cardAtivosTitulo: 'Equipamentos',
    cardAtivosDesc: 'Cadastro, alocação e histórico de equipamentos',
    cardAuditDesc: 'Visitas de campo e controle de pendências',
  },
} as const

export async function DashboardView({ tipo }: { tipo: Tipo }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!canViewRental(session)) redirect('/dashboard')

  const cfg = CONFIG[tipo]
  const Icon = cfg.icon

  const [
    totalAtivos,
    ativosDisponiveis,
    ativosAlocados,
    ativosManutencao,
    osAbertas,
    pendenciasAbertas,
    medicoesEnviadas,
  ] = await Promise.all([
    prisma.ativo.count({ where: { status: { not: 'inativo' }, tipo } }),
    prisma.ativo.count({ where: { status: 'disponivel', tipo } }),
    prisma.ativo.count({ where: { status: 'alocado', tipo } }),
    prisma.ativo.count({ where: { status: 'manutencao', tipo } }),
    prisma.ordemServico.count({ where: { status: { in: ['aberta', 'em_execucao'] }, ativo: { tipo } } }),
    prisma.pendenciaAuditoria.count({ where: { status: { in: ['aberta', 'em_tratativa'] }, visita: { moduloTipo: tipo } } }),
    prisma.medicaoLocacao.count({ where: { status: { in: ['enviada', 'aprovada', 'guia_gerada'] }, moduloTipo: tipo } }),
  ])

  const cards = [
    { label: cfg.labelAtivos, value: totalAtivos, icon: Icon, color: cfg.cardAccent, bg: tipo === 'veiculo' ? 'bg-blue-50' : 'bg-amber-50', href: `${cfg.base}/ativos` },
    { label: 'Disponíveis', value: ativosDisponiveis, icon: Icon, color: 'text-green-600', bg: 'bg-green-50', href: `${cfg.base}/ativos?status=disponivel` },
    { label: 'Alocados', value: ativosAlocados, icon: Icon, color: 'text-indigo-600', bg: 'bg-indigo-50', href: `${cfg.base}/ativos?status=alocado` },
    { label: 'Em manutenção', value: ativosManutencao, icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', href: `${cfg.base}/ativos?status=manutencao` },
    { label: 'OS abertas', value: osAbertas, icon: Wrench, color: osAbertas > 0 ? 'text-red-600' : 'text-gray-500', bg: osAbertas > 0 ? 'bg-red-50' : 'bg-gray-50', href: `${cfg.base}/manutencao` },
    { label: 'Pendências auditoria', value: pendenciasAbertas, icon: ClipboardCheck, color: pendenciasAbertas > 0 ? 'text-amber-600' : 'text-gray-500', bg: pendenciasAbertas > 0 ? 'bg-amber-50' : 'bg-gray-50', href: `${cfg.base}/auditorias` },
    { label: 'Medições pendentes', value: medicoesEnviadas, icon: Receipt, color: medicoesEnviadas > 0 ? 'text-purple-600' : 'text-gray-500', bg: medicoesEnviadas > 0 ? 'bg-purple-50' : 'bg-gray-50', href: `${cfg.base}/medicoes` },
  ]

  return (
    <div className="space-y-6">
      <TipoSwitcher tipo={tipo} func="dashboard" />
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gauge className="w-5 h-5" />
          {cfg.titulo}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{cfg.subtitulo}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`bg-white rounded-xl border border-gray-200 p-4 ${cfg.accentBorder} hover:shadow-sm transition-all`}
          >
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </Link>
        ))}
      </div>

      {(osAbertas > 0 || pendenciasAbertas > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Atenção necessária</p>
            <ul className="mt-1 space-y-0.5 text-amber-700">
              {osAbertas > 0 && <li>{osAbertas} ordem(ns) de serviço aberta(s)</li>}
              {pendenciasAbertas > 0 && <li>{pendenciasAbertas} pendência(s) de auditoria em aberto</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href={`${cfg.base}/ativos`} className={`bg-white rounded-xl border border-gray-200 p-5 ${cfg.accentBorder} transition-all`}>
          <Icon className={`w-6 h-6 ${cfg.cardAccent} mb-2`} />
          <h3 className="font-semibold text-gray-900">{cfg.cardAtivosTitulo}</h3>
          <p className="text-xs text-gray-500 mt-1">{cfg.cardAtivosDesc}</p>
        </Link>
        <Link href={`${cfg.base}/medicoes`} className={`bg-white rounded-xl border border-gray-200 p-5 ${cfg.accentBorder} transition-all`}>
          <Receipt className="w-6 h-6 text-purple-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Medições</h3>
          <p className="text-xs text-gray-500 mt-1">Faturamento mensal por contrato — aprovação e pagamento</p>
        </Link>
        <Link href={`${cfg.base}/auditorias`} className={`bg-white rounded-xl border border-gray-200 p-5 ${cfg.accentBorder} transition-all`}>
          <ClipboardCheck className="w-6 h-6 text-green-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Auditorias</h3>
          <p className="text-xs text-gray-500 mt-1">{cfg.cardAuditDesc}</p>
        </Link>
      </div>
    </div>
  )
}
