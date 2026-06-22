import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }
const PODE_APROVAR = ['master', 'admin', 'director', 'manager', 'supervisor']

const PatchSchema = z.object({
  status:           z.enum(['aprovado', 'reprovado']),
  motivoReprovacao: z.string().max(500).nullable().optional(),
})

// PATCH — aprovar/reprovar (supervisor libera o carro)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_APROVAR.includes(session.user.role)) return apiError('Sem permissão para aprovar', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const updated = await prisma.veiculoChecklist.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status,
      aprovadorId: session.user.id,
      aprovadoEm: new Date(),
      motivoReprovacao: parsed.data.status === 'reprovado' ? (parsed.data.motivoReprovacao ?? null) : null,
    },
    include: { aprovador: { select: { id: true, name: true } } },
  }).catch(() => null)
  if (!updated) return apiError('Checklist não encontrado', 404)
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_APROVAR.includes(session.user.role)) return apiError('Sem permissão', 403)

  await prisma.veiculoChecklistFoto.deleteMany({ where: { checklistId: params.id } })
  await prisma.veiculoChecklist.deleteMany({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
