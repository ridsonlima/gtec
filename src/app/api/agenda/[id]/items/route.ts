import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }

const PatchItemSchema = z.object({
  itemId:       z.string().uuid(),
  status:       z.enum(['pending', 'discussed', 'done', 'deferred']).optional(),
  decisionMade: z.string().max(2000).nullable().optional(),
  notes:        z.string().max(2000).nullable().optional(),
})

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

  const { itemId, status, decisionMade, notes } = parsed.data

  // Confirmar que o item pertence a esta agenda
  const item = await prisma.agendaItem.findFirst({
    where: { id: itemId, agendaId: params.id },
  })
  if (!item) return apiError('Item não encontrado', 404)

  const updated = await prisma.agendaItem.update({
    where: { id: itemId },
    data: {
      ...(status       !== undefined && { status }),
      ...(decisionMade !== undefined && { decisionMade }),
      ...(notes        !== undefined && { notes }),
    },
  })

  return apiSuccess(updated)
}
