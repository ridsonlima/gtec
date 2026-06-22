import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }

const PatchItemSchema = z.object({
  itemId:         z.string().uuid(),
  title:          z.string().min(1).max(200).optional(),
  description:    z.string().max(2000).nullable().optional(),
  status:         z.enum(['pending', 'discussed', 'done', 'deferred']).optional(),
  decisionMade:   z.string().max(2000).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
  evolucoes:      z.string().max(4000).nullable().optional(),
  situacao:       z.string().max(4000).nullable().optional(),
  proximosPassos: z.string().max(4000).nullable().optional(),
})

const CreateItemSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
})

// POST /api/agenda/[id]/items  — adiciona um novo tema à pauta já agendada
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) {
    return apiError('Sem permissão', 403)
  }

  const body = await req.json()
  const parsed = CreateItemSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  // Confirma que a agenda existe
  const agenda = await prisma.meetingAgenda.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!agenda) return apiError('Pauta não encontrada', 404)

  // Próxima ordem
  const last = await prisma.agendaItem.findFirst({
    where: { agendaId: params.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const created = await prisma.agendaItem.create({
    data: {
      agendaId: params.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      origin: 'manual',
      order: (last?.order ?? 0) + 1,
      status: 'pending',
    },
  })

  return apiSuccess(created, 201)
}

// PATCH /api/agenda/[id]/items  — atualiza um item da pauta
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) {
    return apiError('Sem permissão', 403)
  }

  const body = await req.json()
  const parsed = PatchItemSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const { itemId, title, description, status, decisionMade, notes, evolucoes, situacao, proximosPassos } = parsed.data

  // Confirmar que o item pertence a esta agenda
  const item = await prisma.agendaItem.findFirst({
    where: { id: itemId, agendaId: params.id },
  })
  if (!item) return apiError('Item não encontrado', 404)

  const updated = await prisma.agendaItem.update({
    where: { id: itemId },
    data: {
      ...(title          !== undefined && { title }),
      ...(description     !== undefined && { description }),
      ...(status         !== undefined && { status }),
      ...(decisionMade   !== undefined && { decisionMade }),
      ...(notes          !== undefined && { notes }),
      ...(evolucoes      !== undefined && { evolucoes }),
      ...(situacao       !== undefined && { situacao }),
      ...(proximosPassos !== undefined && { proximosPassos }),
    },
  })

  return apiSuccess(updated)
}
