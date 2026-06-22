import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }
const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

const PatchSchema = z.object({
  descricao:     z.string().min(1).max(500).optional(),
  categoria:     z.enum(['material', 'licenca', 'projeto', 'frente', 'mao_obra', 'equipamento', 'outro']).optional(),
  impacto:       z.string().max(1000).nullable().optional(),
  responsavelId: z.string().uuid().optional(),
  prazo:         z.string().optional(),
  status:        z.enum(['aberta', 'removida']).optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const exists = await prisma.obraRestricao.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Restrição não encontrada', 404)

  const d = parsed.data
  const prazo = d.prazo ? new Date(d.prazo) : undefined
  if (prazo && isNaN(prazo.getTime())) return apiError('Prazo inválido', 400)

  const updated = await prisma.obraRestricao.update({
    where: { id: params.id },
    data: {
      ...(d.descricao     !== undefined && { descricao: d.descricao.trim() }),
      ...(d.categoria     !== undefined && { categoria: d.categoria }),
      ...(d.impacto       !== undefined && { impacto: d.impacto }),
      ...(d.responsavelId !== undefined && { responsavelId: d.responsavelId }),
      ...(prazo           !== undefined && { prazo }),
      ...(d.status        !== undefined && { status: d.status, removidaEm: d.status === 'removida' ? new Date() : null }),
    },
    include: { responsavel: { select: { id: true, name: true } } },
  })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  await prisma.obraRestricao.deleteMany({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
