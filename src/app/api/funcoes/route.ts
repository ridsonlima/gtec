import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

const CreateSchema = z.object({
  nome: z.string().min(1).max(120),
  treinamentos: z.array(z.string().max(120)).optional(),
})

// GET /api/funcoes — lista as funções (backfill dos cargos já usados em funcionários)
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const usados = await prisma.funcionario.findMany({
    where: { cargo: { not: null } },
    select: { cargo: true },
    distinct: ['cargo'],
  })
  const nomes = usados.map((u) => u.cargo).filter((n): n is string => !!n && n.trim() !== '')
  if (nomes.length > 0) {
    await prisma.funcao.createMany({
      data: nomes.map((nome) => ({ nome })),
      skipDuplicates: true,
    })
  }

  const funcoes = await prisma.funcao.findMany({ orderBy: { nome: 'asc' } })
  return apiSuccess(funcoes)
}

// POST /api/funcoes — cria função
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const nome = parsed.data.nome.trim()
  const existente = await prisma.funcao.findUnique({ where: { nome } })
  if (existente) return apiSuccess(existente, 200)

  const created = await prisma.funcao.create({
    data: { nome, treinamentos: parsed.data.treinamentos ?? [] },
  })
  return apiSuccess(created, 201)
}
