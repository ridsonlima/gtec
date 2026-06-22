import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE = ['master', 'admin', 'manager', 'supervisor']

const Schema = z.object({
  ativoId:      z.string().uuid(),
  condutorId:   z.string().uuid().nullable().optional(),
  dataInfracao: z.string().min(1),
  infracao:     z.string().min(1).max(300),
  local:        z.string().max(200).nullable().optional(),
  valor:        z.number().min(0).nullable().optional(),
  pontos:       z.number().int().min(0).max(40).nullable().optional(),
  vencimento:   z.string().nullable().optional(),
  status:       z.enum(['pendente', 'pago', 'recorrido', 'indicado']).default('pendente'),
  observacoes:  z.string().max(1000).nullable().optional(),
  anexoUrl:     z.string().url().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  // Se não indicou condutor, usa o condutor atual do veículo
  let condutorId = d.condutorId ?? null
  if (!condutorId) {
    const a = await prisma.ativo.findUnique({ where: { id: d.ativoId }, select: { condutorAtualId: true } })
    condutorId = a?.condutorAtualId ?? null
  }

  const created = await prisma.veiculoMulta.create({
    data: {
      ativoId: d.ativoId,
      condutorId,
      dataInfracao: new Date(d.dataInfracao),
      infracao: d.infracao.trim(),
      local: d.local ?? null,
      valor: d.valor ?? null,
      pontos: d.pontos ?? null,
      vencimento: d.vencimento ? new Date(d.vencimento) : null,
      status: d.status,
      observacoes: d.observacoes ?? null,
      anexoUrl: d.anexoUrl ?? null,
      createdById: session.user.id,
    },
    include: { condutor: { select: { id: true, nome: true } } },
  })
  return apiSuccess(created, 201)
}
