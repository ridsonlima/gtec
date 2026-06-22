import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove, getUserAreaIds } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'

/**
 * POST /api/agenda/gerar-semanal
 * Gera uma pauta semanal pré-populada com os sinais da semana:
 * - sugestões de reports publicados
 * - demandas vencidas/críticas
 * - comunicados importantes/urgentes recentes
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const areaIds = getUserAreaIds(session) // null = vê tudo
  const demandAreaFilter = areaIds ? { areaId: { in: areaIds } } : {}
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000)

  const [reportSuggestions, overdueDemands, comunicados] = await Promise.all([
    prisma.report.findMany({
      where: { status: 'published', agendaSuggestion: { not: null }, agendaItems: { none: {} } },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, agendaSuggestion: true },
    }),
    prisma.demand.findMany({
      where: { status: { notIn: ['completed', 'cancelled'] }, isOverdue: true, ...demandAreaFilter },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 6,
      select: { id: true, title: true, area: { select: { name: true } } },
    }),
    prisma.comunicado.findMany({
      where: {
        ativo: true,
        prioridade: { in: ['importante', 'urgente'] },
        createdAt: { gte: seteDiasAtras },
        ...(areaIds ? { OR: [{ alvoTipo: 'todos' }, { alvoTipo: 'area', alvoAreaId: { in: areaIds } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true },
    }),
  ])

  // Monta os itens da pauta
  let order = 0
  const items: { title: string; description: string | null; origin: string; reportId: string | null; demandId: string | null; order: number }[] = []

  // Item de abertura sempre presente
  items.push({
    title: 'Revisão da semana anterior e pendências gerais',
    description: 'Acompanhamento dos encaminhamentos da última reunião.',
    origin: 'other',
    reportId: null,
    demandId: null,
    order: order++,
  })

  for (const r of reportSuggestions) {
    items.push({
      title: r.title,
      description: r.agendaSuggestion,
      origin: 'report',
      reportId: r.id,
      demandId: null,
      order: order++,
    })
  }

  for (const d of overdueDemands) {
    items.push({
      title: `Demanda vencida: ${d.title}`,
      description: d.area?.name ? `Área: ${d.area.name}` : null,
      origin: 'demand',
      reportId: null,
      demandId: d.id,
      order: order++,
    })
  }

  if (comunicados.length > 0) {
    items.push({
      title: 'Comunicados importantes da semana',
      description: comunicados.map((c) => `• ${c.title}`).join('\n'),
      origin: 'other',
      reportId: null,
      demandId: null,
      order: order++,
    })
  }

  const hoje = new Date()
  const dataLabel = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const agenda = await prisma.meetingAgenda.create({
    data: {
      title: `Reunião Semanal — ${dataLabel}`,
      objective: 'Pauta gerada automaticamente a partir das pendências, reports e comunicados da semana.',
      tipo: 'diretoria',
      status: 'preparing',
      createdById: session.user.id,
      items: { create: items },
    },
    include: { items: true },
  })

  audit({ action: ACTIONS.AGENDA_CREATED, objectType: 'agenda', objectId: agenda.id, userId: session.user.id, metadata: { gerada: 'semanal', itens: items.length } }).catch(console.error)

  return apiSuccess({ id: agenda.id, itens: items.length }, 201)
}
