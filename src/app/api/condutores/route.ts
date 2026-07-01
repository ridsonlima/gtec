import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE = ['master', 'admin', 'manager', 'supervisor']

const CreateSchema = z.object({
  nome:         z.string().min(1).max(120),
  cnh:          z.string().max(30).nullable().optional(),
  categoriaCnh: z.string().max(10).nullable().optional(),
  validadeCnh:  z.string().nullable().optional(),
  telefone:     z.string().max(30).nullable().optional(),
  observacoes:  z.string().max(500).nullable().optional(),
})

// GET /api/condutores
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const condutores = await prisma.condutor.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: { veiculos: { select: { id: true, tag: true, placa: true, descricao: true } }, _count: { select: { multas: true } } },
  })
  return apiSuccess(condutores)
}

// POST /api/condutores
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const created = await prisma.condutor.create({
    data: {
      nome: d.nome.trim(),
      cnh: d.cnh ?? null,
      categoriaCnh: d.categoriaCnh ?? null,
      validadeCnh: d.validadeCnh ? new Date(d.validadeCnh) : null,
      telefone: d.telefone ?? null,
      observacoes: d.observacoes ?? null,
    },
  })
  return apiSuccess(created, 201)
}
