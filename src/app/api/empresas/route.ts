import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

const CreateSchema = z.object({
  nome: z.string().min(1).max(120),
  tipo: z.enum(['propria', 'terceira']).nullable().optional(),
  cnpj: z.string().max(20).nullable().optional(),
})

// GET /api/empresas — lista as empresas (faz backfill das já usadas em funcionários)
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  // Backfill: garante que empresas já digitadas em funcionários existam no cadastro
  const usadas = await prisma.funcionario.findMany({
    where: { empresa: { not: null } },
    select: { empresa: true },
    distinct: ['empresa'],
  })
  const nomes = usadas.map((u) => u.empresa).filter((n): n is string => !!n && n.trim() !== '')
  if (nomes.length > 0) {
    await prisma.empresaFuncionario.createMany({
      data: nomes.map((nome) => ({ nome })),
      skipDuplicates: true,
    })
  }

  const empresas = await prisma.empresaFuncionario.findMany({ orderBy: { nome: 'asc' } })
  return apiSuccess(empresas)
}

// POST /api/empresas — cria empresa
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const nome = parsed.data.nome.trim()
  const existente = await prisma.empresaFuncionario.findUnique({ where: { nome } })
  if (existente) return apiSuccess(existente, 200)

  const created = await prisma.empresaFuncionario.create({
    data: { nome, tipo: parsed.data.tipo ?? null, cnpj: parsed.data.cnpj ?? null },
  })
  return apiSuccess(created, 201)
}
