import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

type Params = { params: { id: string } }

const UpsertSchema = z.object({
  treinamentoId: z.string().uuid().optional(),
  nome:          z.string().min(1).max(120),
  realizadoEm:   z.string().datetime().nullable().optional(),
  validade:      z.string().datetime().nullable().optional(),
  observacao:    z.string().max(500).nullable().optional(),
})

const DeleteSchema = z.object({ treinamentoId: z.string().uuid() })

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

// POST /api/funcionarios/[id]/treinamentos — cria ou atualiza (upsert por id)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const func = await prisma.funcionario.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!func) return apiError('Funcionário não encontrado', 404)

  const { treinamentoId, nome, observacao } = parsed.data
  const realizadoEm = parseDate(parsed.data.realizadoEm)
  const validade = parseDate(parsed.data.validade)

  if (treinamentoId) {
    const t = await prisma.funcionarioTreinamento.findFirst({
      where: { id: treinamentoId, funcionarioId: params.id },
    })
    if (!t) return apiError('Treinamento não encontrado', 404)
    const updated = await prisma.funcionarioTreinamento.update({
      where: { id: treinamentoId },
      data: { nome, realizadoEm, validade, observacao: observacao ?? null },
    })
    return apiSuccess(updated)
  }

  const created = await prisma.funcionarioTreinamento.create({
    data: { funcionarioId: params.id, nome, realizadoEm, validade, observacao: observacao ?? null },
  })
  return apiSuccess(created, 201)
}

// DELETE /api/funcionarios/[id]/treinamentos
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  await prisma.funcionarioTreinamento.deleteMany({
    where: { id: parsed.data.treinamentoId, funcionarioId: params.id },
  })
  return apiSuccess({ ok: true })
}
