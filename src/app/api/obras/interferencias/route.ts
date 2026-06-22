import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

const CreateSchema = z.object({
  contratoId:         z.string().uuid(),
  tipo:               z.enum(['interferencia', 'paralisacao']).default('interferencia'),
  local:              z.string().max(200).nullable().optional(),
  descricao:          z.string().min(1).max(2000),
  responsavelExterno: z.string().max(160).nullable().optional(),
  dataInicio:         z.string().min(1),
})

// POST /api/obras/interferencias
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const dataInicio = new Date(parsed.data.dataInicio)
  if (isNaN(dataInicio.getTime())) return apiError('Data inválida', 400)

  const created = await prisma.obraInterferencia.create({
    data: {
      contratoId: parsed.data.contratoId,
      tipo: parsed.data.tipo,
      local: parsed.data.local ?? null,
      descricao: parsed.data.descricao.trim(),
      responsavelExterno: parsed.data.responsavelExterno ?? null,
      dataInicio,
      createdById: session.user.id,
    },
  })

  return apiSuccess(created, 201)
}
