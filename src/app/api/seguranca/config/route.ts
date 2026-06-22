import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageSeguranca } from '@/lib/permissions'
import { z } from 'zod'

const ANO = 2026

const PutSchema = z.object({
  diasSemAcidentes:       z.number().int().min(0).optional(),
  treinamentosConforme:   z.number().int().min(0).optional(),
  treinamentosNecessitam: z.number().int().min(0).optional(),
  totalCustos:            z.number().min(0).optional(),
  inspecaoSeguranca:      z.number().int().min(0).optional(),
  dssRealizados:          z.number().int().min(0).optional(),
  mesReferencia:          z.string().max(20).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const config = await prisma.segurancaConfig.findUnique({ where: { ano: ANO } })
  return apiSuccess(config)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const data = {
    diasSemAcidentes:       d.diasSemAcidentes ?? 0,
    treinamentosConforme:   d.treinamentosConforme ?? 0,
    treinamentosNecessitam: d.treinamentosNecessitam ?? 0,
    totalCustos:            d.totalCustos ?? 0,
    inspecaoSeguranca:      d.inspecaoSeguranca ?? 0,
    dssRealizados:          d.dssRealizados ?? 0,
    mesReferencia:          d.mesReferencia ?? 'ATUAL',
    syncedAt:               new Date(),
  }

  const config = await prisma.segurancaConfig.upsert({
    where: { ano: ANO },
    create: { ano: ANO, ...data },
    update: data,
  })

  return apiSuccess(config)
}
