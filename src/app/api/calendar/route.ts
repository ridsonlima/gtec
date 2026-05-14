import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { getUserAreaIds } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date()
  const to   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date(from.getTime() + 60 * 86400000)

  const allowedAreaIds = getUserAreaIds(session)
  const areaFilter = allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}

  const [demands, contracts, agendas] = await Promise.all([
    // Demandas com prazo no período
    prisma.demand.findMany({
      where: {
        ...areaFilter,
        dueDate: { gte: from, lte: to },
        status: { notIn: ['completed', 'cancelled'] },
      },
      select: {
        id: true, title: true, dueDate: true, priority: true, isOverdue: true,
        area: { select: { name: true } },
      },
    }),
    // Contratos com vencimento no período
    prisma.contract.findMany({
      where: {
        ...areaFilter,
        endDate: { gte: from, lte: to },
        status: { notIn: ['closed', 'cancelled'] },
      },
      select: {
        id: true, name: true, number: true, endDate: true, status: true,
        area: { select: { name: true } },
      },
    }),
    // Reuniões agendadas no período
    prisma.meetingAgenda.findMany({
      where: {
        scheduledAt: { gte: from, lte: to },
        status: { notIn: ['cancelled'] },
      },
      select: {
        id: true, title: true, scheduledAt: true, status: true,
        _count: { select: { items: true } },
      },
    }),
  ])

  const events = [
    ...demands.map((d) => ({
      id: d.id,
      type: 'demand' as const,
      title: d.title,
      subtitle: d.area.name,
      date: d.dueDate!.toISOString(),
      href: `/demandas/${d.id}`,
      color: d.isOverdue ? 'red' : d.priority === 'critical' ? 'orange' : 'blue',
      badge: d.isOverdue ? 'Vencida' : d.priority === 'critical' ? 'Crítica' : null,
    })),
    ...contracts.map((c) => ({
      id: c.id,
      type: 'contract' as const,
      title: c.name,
      subtitle: `${c.number} · ${c.area.name}`,
      date: c.endDate!.toISOString(),
      href: `/contratos/${c.id}`,
      color: c.status === 'at_risk' ? 'red' : c.status === 'delayed' ? 'orange' : 'purple',
      badge: 'Contrato',
    })),
    ...agendas.map((a) => ({
      id: a.id,
      type: 'agenda' as const,
      title: a.title,
      subtitle: `${a._count.items} itens`,
      date: a.scheduledAt!.toISOString(),
      href: `/pauta/${a.id}`,
      color: 'green',
      badge: 'Reunião',
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return apiSuccess(events)
}
