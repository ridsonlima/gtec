import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { addDays } from 'date-fns'
import { Sun, AlertTriangle, Clock, Camera, Bell, CheckCircle2, ChevronRight, Megaphone } from 'lucide-react'

/**
 * Painel pessoal "Meu Dia" — mostra ao usuário logado o que exige a SUA ação hoje.
 * Orientado à ação (não a microgerenciamento): só aparece o que está sob sua responsabilidade.
 */
export async function MeuDiaPanel({ userId, userName }: { userId: string; userName?: string }) {
  const hoje = new Date()
  const em3dias = addDays(hoje, 3)

  // Áreas do usuário (para comunicados direcionados por área)
  const scopes = await prisma.userAreaScope.findMany({ where: { userId }, select: { areaId: true } })
  const areaIds = scopes.map((s) => s.areaId)

  const [vencidas, aVencer, evidencias, naoLidas, comunicadosPendentes] = await Promise.all([
    // Minhas demandas vencidas
    prisma.demand.findMany({
      where: { responsibleId: userId, isOverdue: true, status: { notIn: ['completed', 'cancelled'] } },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { id: true, title: true, dueDate: true, priority: true, area: { select: { name: true } } },
    }),
    // Minhas demandas a vencer nos próximos 3 dias (ainda não vencidas)
    prisma.demand.findMany({
      where: {
        responsibleId: userId,
        isOverdue: false,
        status: { notIn: ['completed', 'cancelled'] },
        dueDate: { gte: hoje, lte: em3dias },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { id: true, title: true, dueDate: true, priority: true, area: { select: { name: true } } },
    }),
    // Evidências/cobranças pendentes para mim
    prisma.evidenceRequest.findMany({
      where: { responsibleId: userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, description: true, objectType: true, objectId: true },
    }),
    // Notificações não lidas
    prisma.notification.count({ where: { userId, isRead: false } }),
    // Comunicados oficiais aguardando minha ciência
    prisma.comunicado.findMany({
      where: {
        ativo: true,
        exigeAceite: true,
        OR: [{ alvoTipo: 'todos' }, { alvoTipo: 'area', alvoAreaId: { in: areaIds } }],
        leituras: { none: { userId, aceiteEm: { not: null } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, prioridade: true },
    }),
  ])

  const totalPendencias = vencidas.length + aVencer.length + evidencias.length + naoLidas + comunicadosPendentes.length

  // Tudo em dia
  if (totalPendencias === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-900">Tudo em dia{userName ? `, ${userName.split(' ')[0]}` : ''}! 🎉</p>
          <p className="text-xs text-green-700 mt-0.5">Você não tem demandas vencidas, cobranças ou avisos pendentes.</p>
        </div>
      </div>
    )
  }

  function fmt(d: Date) {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2">
        <Sun className="w-4 h-4 text-white" />
        <h2 className="text-sm font-semibold text-white">Meu dia — o que precisa da sua atenção</h2>
        <span className="ml-auto text-xs font-medium text-white/90 bg-white/20 px-2 py-0.5 rounded-full">
          {totalPendencias} {totalPendencias === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {/* Comunicados aguardando ciência */}
        {comunicadosPendentes.length > 0 && (
          <Secao
            icon={<Megaphone className="w-4 h-4 text-blue-500" />}
            titulo="Comunicados aguardando sua ciência"
            cor="text-blue-600"
            count={comunicadosPendentes.length}
          >
            {comunicadosPendentes.map((c) => (
              <ItemLink key={c.id} href="/comunicados" titulo={c.title} meta={c.prioridade === 'urgente' ? '⚠ Urgente · confirme a ciência' : 'Confirme a ciência'} corMeta="text-blue-500" />
            ))}
          </Secao>
        )}

        {/* Vencidas */}
        {vencidas.length > 0 && (
          <Secao
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
            titulo="Demandas vencidas"
            cor="text-red-600"
            count={vencidas.length}
          >
            {vencidas.map((d) => (
              <ItemLink key={d.id} href={`/demandas/${d.id}`} titulo={d.title} meta={`${d.area?.name ?? ''} · venceu ${fmt(d.dueDate)}`} corMeta="text-red-500" />
            ))}
          </Secao>
        )}

        {/* A vencer */}
        {aVencer.length > 0 && (
          <Secao
            icon={<Clock className="w-4 h-4 text-amber-500" />}
            titulo="A vencer em 3 dias"
            cor="text-amber-600"
            count={aVencer.length}
          >
            {aVencer.map((d) => (
              <ItemLink key={d.id} href={`/demandas/${d.id}`} titulo={d.title} meta={`${d.area?.name ?? ''} · vence ${fmt(d.dueDate)}`} corMeta="text-amber-600" />
            ))}
          </Secao>
        )}

        {/* Evidências/cobranças */}
        {evidencias.length > 0 && (
          <Secao
            icon={<Camera className="w-4 h-4 text-purple-500" />}
            titulo="Evidências solicitadas a você"
            cor="text-purple-600"
            count={evidencias.length}
          >
            {evidencias.map((e) => {
              const href = e.objectType === 'demand' ? `/demandas/${e.objectId}` : e.objectType === 'contract' ? `/contratos/${e.objectId}` : `/reports/${e.objectId}`
              return <ItemLink key={e.id} href={href} titulo={e.description} meta="Aguardando comprovação" corMeta="text-purple-500" />
            })}
          </Secao>
        )}

        {/* Notificações não lidas */}
        {naoLidas > 0 && (
          <Link href="/notificacoes" className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
            <Bell className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-gray-700 flex-1">
              Você tem <span className="font-semibold text-blue-600">{naoLidas}</span> {naoLidas === 1 ? 'notificação não lida' : 'notificações não lidas'}
            </p>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        )}
      </div>
    </div>
  )
}

function Secao({ icon, titulo, cor, count, children }: { icon: React.ReactNode; titulo: string; cor: string; count: number; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${cor}`}>{titulo}</h3>
        <span className="text-xs text-gray-400">({count})</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ItemLink({ href, titulo, meta, corMeta }: { href: string; titulo: string; meta: string; corMeta: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate group-hover:text-blue-600">{titulo}</p>
        <p className={`text-xs ${corMeta}`}>{meta}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </Link>
  )
}
