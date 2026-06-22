import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE = ['master', 'admin', 'manager', 'supervisor']

const Schema = z.object({
  ativoId:    z.string().uuid(),
  tipo:       z.enum(['seguro', 'ipva', 'licenciamento', 'outro']),
  descricao:  z.string().max(200).nullable().optional(),
  valor:      z.number().min(0).nullable().optional(),
  vencimento: z.string().nullable().optional(),
  anexoUrl:   z.string().url().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const created = await prisma.veiculoDocumento.create({
    data: {
      ativoId: d.ativoId,
      tipo: d.tipo,
      descricao: d.descricao ?? null,
      valor: d.valor ?? null,
      vencimento: d.vencimento ? new Date(d.vencimento) : null,
      anexoUrl: d.anexoUrl ?? null,
      createdById: session.user.id,
    },
  })
  return apiSuccess(created, 201)
}
