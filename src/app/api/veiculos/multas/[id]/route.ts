import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }
const PODE = ['master', 'admin', 'manager', 'supervisor']

const PatchSchema = z.object({
  status:      z.enum(['pendente', 'pago', 'recorrido', 'indicado']).optional(),
  condutorId:  z.string().uuid().nullable().optional(),
  valor:       z.number().min(0).nullable().optional(),
  observacoes: z.string().max(1000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const updated = await prisma.veiculoMulta.update({
    where: { id: params.id },
    data: {
      ...(d.status      !== undefined && { status: d.status }),
      ...(d.condutorId  !== undefined && { condutorId: d.condutorId }),
      ...(d.valor       !== undefined && { valor: d.valor }),
      ...(d.observacoes !== undefined && { observacoes: d.observacoes }),
    },
    include: { condutor: { select: { id: true, nome: true } } },
  }).catch(() => null)
  if (!updated) return apiError('Multa não encontrada', 404)
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  await prisma.veiculoMulta.deleteMany({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
