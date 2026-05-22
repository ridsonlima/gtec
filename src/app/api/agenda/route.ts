import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { NextRequest } from 'next/server'
import { isManagerOrAbove } from '@/lib/permissions'
import { z } from 'zod'
import { audit, ACTIONS } from '@/lib/audit'

const AgendaItemSchema = z.object({
  title:            z.string().min(1).max(200),
  description:      z.string().max(1000).nullable().optional(),
  origin:           z.enum(['director', 'area', 'report', 'demand', 'contract', 'recurring', 'other']),
  reportId:         z.string().uuid().nullable().optional(),
  demandId:         z.string().uuid().nullable().optional(),
  estimatedMinutes: z.number().positive().nullable().optional(),
  order:            z.number().int().default(0),
})

const CreateAgendaSchema = z.object({
  title:                 z.string().min(3).max(200),
  objective:             z.string().max(1000).nullable().optional(),
  scheduledAt:           z.string().datetime().nullable().optional(),
  tipo:                  z.enum(['diretoria', 'interarea', 'externo']).default('diretoria'),
  areasEnvolvidas:       z.array(z.string()).optional(),        // array de IDs de áreas
  participantesExternos: z.string().max(500).nullable().optional(),
  items:                 z.array(AgendaItemSchema).min(1),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Acesso restrito', 403)

  const { searchParams } = req.nextUrl
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '30'))
  const tipo  = searchParams.get('tipo') ?? undefined

  const where = tipo ? { tipo } : {}

  const [agendas, total] = await prisma.$transaction([
    prisma.meetingAgenda.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.meetingAgenda.count({ where }),
  ])

  return apiSuccess({ data: agendas, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão para criar pautas', 403)

  const body = await req.json()
  const parsed = CreateAgendaSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const { title, objective, scheduledAt, tipo, areasEnvolvidas, participantesExternos, items } = parsed.data

  const agenda = await prisma.meetingAgenda.create({
    data: {
      title,
      objective,
      scheduledAt:           scheduledAt ? new Date(scheduledAt) : null,
      tipo,
      areasEnvolvidas:       areasEnvolvidas?.length ? JSON.stringify(areasEnvolvidas) : null,
      participantesExternos: participantesExternos || null,
      createdById:           session.user.id,
      items: {
        create: items.map((item) => ({
          title:            item.title,
          description:      item.description,
          origin:           item.origin,
          reportId:         item.reportId,
          demandId:         item.demandId,
          estimatedMinutes: item.estimatedMinutes,
          order:            item.order,
        })),
      },
    },
    include: { items: true },
  })

  audit({ action: ACTIONS.AGENDA_CREATED, objectType: 'agenda', objectId: agenda.id, userId: session.user.id }).catch(console.error)

  return apiSuccess(agenda, 201)
}
