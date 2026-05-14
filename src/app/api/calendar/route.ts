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

  // Filtros opcionais
  const typeParam        = searchParams.get('type')        // ex: "demand,contract"
  const responsibleParam = searchParams.get('responsible') // userId

  const types = typeParam ? typeParam.split(',') : ['demand', 'contract', 'agenda']

  const allowedAreaIds = getUserAreaIds(session)
  const areaFilter = allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}

  const responsibleFilter = responsibleParam ? { responsibleId: responsibleParam } : {}

  const [demands, contracts, agendas] = await Promise.all([
    types.includes('demand')
      ? prisma.demand.findMany({
          where: {
            ...areaFilter,
            ...responsibleFilter,
            dueDate: { gte: from, lte: to },
            status: { notIn: ['completed', 'cancelled'] },
          },
          select: {
            id: true, title: true, dueDate: true, priority: true, isOverdue: true,
            area: { select: { name: true } },
            responsible: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),

    types.includes('contract')
      ? prisma.contract.findMany({
          where: {
            ...areaFilter,
            ...(responsibleParam ? { responsibleId: responsibleParam } : {}),
            endDate: { gte: from, lte: to },
            status: { notIn: ['closed', 'cancelled'] },
          },
          select: {
            id: true, name: true, number: true, endDate: true, status: true,
            area: { select: { name: true } },
            responsible: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),

    types.includes('agenda')
      ? prisma.meetingAgenda.findMany({
          where: {
            scheduledAt: { gte: from, lte: to },
            status: { notIn: ['cancelled'] },
          },
          select: {
            id: true, title: true, scheduledAt: true, status: true,
            _count: { select: { items: true } },
            createdBy: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const events = [
    ...(demands as typeof demands).map((d) => ({
      id: d.id,
      type: 'demand' as const,
      title: d.title,
      subtitle: d.area.name,
      date: d.dueDate!.toISOString(),
      href: `/demandas/${d.id}`,
      color: d.isOverdue ? 'red' : d.priority === 'critical' ? 'orange' : 'blue',
      badge: d.isOverdue ? 'Vencida' : d.priority === 'critical' ? 'Crítica' : null,
      responsible: d.responsible ? { id: d.responsible.id, name: d.responsible.name } : null,
    })),
    ...(contracts as typeof contracts).map((c) => ({
      id: c.id,
      type: 'contract' as const,
      title: c.name,
      subtitle: `${c.number} · ${c.area.name}`,
      date: c.endDate!.toISOString(),
      href: `/contratos/${c.id}`,
      color: c.status === 'at_risk' ? 'red' : c.status === 'delayed' ? 'orange' : 'purple',
      badge: 'Contrato',
      responsible: c.responsible ? { id: c.responsible.id, name: c.responsible.name } : null,
    })),
    ...(agendas as typeof agendas).map((a) => ({
      id: a.id,
      type: 'agenda' as const,
      title: a.title,
      subtitle: `${a._count.items} itens`,
      date: a.scheduledAt!.toISOString(),
      href: `/pauta/${a.id}`,
      color: 'green',
      badge: 'Reunião',
      responsible: a.createdBy ? { id: a.createdBy.id, name: a.createdBy.name } : null,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return apiSuccess(events)
}
