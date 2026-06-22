import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

const CreateSchema = z.object({
  contratoId:    z.string().uuid(),
  descricao:     z.string().min(1).max(500),
  categoria:     z.enum(['material', 'licenca', 'projeto', 'frente', 'mao_obra', 'equipamento', 'outro']).default('outro'),
  impacto:       z.string().max(1000).nullable().optional(),
  responsavelId: z.string().uuid(),
  prazo:         z.string().min(1),
})

// POST /api/obras/restricoes
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const prazo = new Date(parsed.data.prazo)
  if (isNaN(prazo.getTime())) return apiError('Prazo inválido', 400)

  const created = await prisma.obraRestricao.create({
    data: {
      contratoId: parsed.data.contratoId,
      descricao: parsed.data.descricao.trim(),
      categoria: parsed.data.categoria,
      impacto: parsed.data.impacto ?? null,
      responsavelId: parsed.data.responsavelId,
      prazo,
      createdById: session.user.id,
    },
    include: { responsavel: { select: { id: true, name: true } } },
  })

  return apiSuccess(created, 201)
}
