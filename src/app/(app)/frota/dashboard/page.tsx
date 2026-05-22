import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import { Gauge, Truck, AlertTriangle, Wrench, ClipboardCheck, Receipt } from 'lucide-react'
import Link from 'next/link'

export default async function FrotaDashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const [
    totalAtivos,
    ativosDisponiveis,
    ativosAlocados,
    ativosManutencao,
    osAbertas,
    pendenciasAbertas,
    medicoesEnviadas,
  ] = await Promise.all([
    prisma.ativo.count({ where: { status: { not: 'inativo' }, tipo: 'veiculo' } }),
    prisma.ativo.count({ where: { status: 'disponivel', tipo: 'veiculo' } }),
    prisma.ativo.count({ where: { status: 'alocado', tipo: 'veiculo' } }),
    prisma.ativo.count({ where: { status: 'manutencao', tipo: 'veiculo' } }),
    prisma.ordemServico.count({ where: { status: { in: ['aberta', 'em_execucao'] }, ativo: { tipo: 'veiculo' } } }),
    prisma.pendenciaAuditoria.count({ where: { status: { in: ['aberta', 'em_tratativa'] }, visita: { moduloTipo: 'veiculo' } } }),
    prisma.medicaoLocacao.count({ where: { status: { in: ['enviada', 'aprovada', 'guia_gerada'] }, moduloTipo: 'veiculo' } }),
  ])

  const cards = [
    { label: 'Veículos ativos', value: totalAtivos, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', href: '/frota/ativos' },
    { label: 'Disponíveis', value: ativosDisponiveis, icon: Truck, color: 'text-green-600', bg: 'bg-green-50', href: '/frota/ativos?status=disponivel' },
    { label: 'Alocados', value: ativosAlocados, icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/frota/ativos?status=alocado' },
    { label: 'Em manutenção', value: ativosManutencao, icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', href: '/frota/ativos?status=manutencao' },
    { label: 'OS abertas', value: osAbertas, icon: Wrench, color: osAbertas > 0 ? 'text-red-600' : 'text-gray-500', bg: osAbertas > 0 ? 'bg-red-50' : 'bg-gray-50', href: '/frota/manutencao' },
    { label: 'Pendências auditoria', value: pendenciasAbertas, icon: ClipboardCheck, color: pendenciasAbertas > 0 ? 'text-amber-600' : 'text-gray-500', bg: pendenciasAbertas > 0 ? 'bg-amber-50' : 'bg-gray-50', href: '/frota/auditorias' },
    { label: 'Medições pendentes', value: medicoesEnviadas, icon: Receipt, color: medicoesEnviadas > 0 ? 'text-purple-600' : 'text-gray-500', bg: medicoesEnviadas > 0 ? 'bg-purple-50' : 'bg-gray-50', href: '/frota/medicoes' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gauge className="w-5 h-5" />
          Dashboard — Frota CDG RENTAL
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral dos veículos, manutenção e faturamento</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
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
        <Link href="/frota/ativos" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-all">
          <Truck className="w-6 h-6 text-blue-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Veículos</h3>
          <p className="text-xs text-gray-500 mt-1">Cadastro, alocação e histórico da frota de veículos</p>
        </Link>
        <Link href="/frota/medicoes" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-all">
          <Receipt className="w-6 h-6 text-purple-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Medições</h3>
          <p className="text-xs text-gray-500 mt-1">Faturamento mensal por contrato — aprovação e pagamento</p>
        </Link>
        <Link href="/frota/auditorias" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-all">
          <ClipboardCheck className="w-6 h-6 text-green-600 mb-2" />
          <h3 className="font-semibold text-gray-900">Auditorias</h3>
          <p className="text-xs text-gray-500 mt-1">Visitas de campo semanais e controle de pendências</p>
        </Link>
      </div>
    </div>
  )
}
