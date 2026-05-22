import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { NextRequest } from 'next/server'
import { isManagerOrAbove } from '@/lib/permissions'

type Params = { params: { id: string } }

// GET /api/agenda/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Acesso restrito', 403)

  const agenda = await prisma.meetingAgenda.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          report: { select: { id: true, title: true } },
          demand: { select: { id: true, title: true } },
        },
      },
    },
  })

  if (!agenda) return apiError('Pauta não encontrada', 404)

  return apiSuccess(agenda)
}

// PATCH /api/agenda/[id] — atualiza campos da pauta (evolucoes, situacao, proximosPassos, proximaReuniao, status)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const agenda = await prisma.meetingAgenda.findUnique({ where: { id: params.id } })
  if (!agenda) return apiError('Pauta não encontrada', 404)

  const body = await req.json()
  const {
    status,
    evolucoes,
    situacao,
    proximosPassos,
    proximaReuniao,
    minutesText,
    scheduledAt,
  } = body

  const VALID_STATUS = ['draft', 'preparing', 'scheduled', 'done', 'held', 'finalized', 'cancelled']
  if (status && !VALID_STATUS.includes(status)) return apiError('Status inválido', 400)

  const data: Record<string, unknown> = {}
  if (status         !== undefined) data.status         = status
  if (evolucoes      !== undefined) data.evolucoes      = evolucoes      || null
  if (situacao       !== undefined) data.situacao       = situacao       || null
  if (proximosPassos !== undefined) data.proximosPassos = proximosPassos || null
  if (proximaReuniao !== undefined) data.proximaReuniao = proximaReuniao ? new Date(proximaReuniao) : null
  if (minutesText    !== undefined) data.minutesText    = minutesText    || null
  if (scheduledAt    !== undefined) data.scheduledAt    = scheduledAt ? new Date(scheduledAt) : null

  const updated = await prisma.meetingAgenda.update({
    where: { id: params.id },
    data,
  })

  return apiSuccess(updated)
}
