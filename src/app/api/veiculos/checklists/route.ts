import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const Schema = z.object({
  ativoId:     z.string().uuid(),
  km:          z.number().int().min(0).nullable().optional(),
  observacoes: z.string().max(1000).nullable().optional(),
  fotos:       z.array(z.object({ item: z.string().max(40), fotoUrl: z.string().url() })).optional(),
})

// POST /api/veiculos/checklists — qualquer usuário autenticado solicita
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const created = await prisma.veiculoChecklist.create({
    data: {
      ativoId: d.ativoId,
      solicitanteId: session.user.id,
      km: d.km ?? null,
      observacoes: d.observacoes ?? null,
      fotos: d.fotos && d.fotos.length > 0 ? { create: d.fotos.map((f) => ({ item: f.item, fotoUrl: f.fotoUrl })) } : undefined,
    },
    include: { fotos: true },
  })
  return apiSuccess(created, 201)
}
