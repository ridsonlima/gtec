import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

const CreateSchema = z.object({
  contratoId: z.string().uuid(),
  dataRef:    z.string().min(1),
  trecho:     z.string().min(1).max(160),
  unidade:    z.string().max(10).default('m'),
  planejado:  z.number().min(0),
  executado:  z.number().min(0),
  observacao: z.string().max(1000).nullable().optional(),
})

// POST /api/obras/avancos
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const dataRef = new Date(parsed.data.dataRef)
  if (isNaN(dataRef.getTime())) return apiError('Data inválida', 400)

  const created = await prisma.obraAvancoFisico.create({
    data: {
      contratoId: parsed.data.contratoId,
      dataRef,
      trecho: parsed.data.trecho.trim(),
      unidade: parsed.data.unidade || 'm',
      planejado: parsed.data.planejado,
      executado: parsed.data.executado,
      observacao: parsed.data.observacao ?? null,
      createdById: session.user.id,
    },
  })

  return apiSuccess(created, 201)
}
