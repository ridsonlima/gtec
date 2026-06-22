import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { TREINAMENTOS_PADRAO } from '@/lib/funcionarios'
import { z } from 'zod'

const CreateSchema = z.object({
  nome: z.string().min(1).max(120),
  descricao: z.string().max(400).nullable().optional(),
  validadeMeses: z.number().int().min(0).max(120).nullable().optional(),
})

// GET /api/treinamentos — catálogo de treinamentos (pré-preenchido com as NRs)
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const existentes = await prisma.treinamentoCatalogo.findMany()
  const porNome = new Map(existentes.map((e) => [e.nome, e]))

  // 1) Cria as NRs padrão que ainda não existem (com descrição e validade)
  const aCriar = TREINAMENTOS_PADRAO.filter((t) => !porNome.has(t.nome))
  if (aCriar.length > 0) {
    await prisma.treinamentoCatalogo.createMany({
      data: aCriar.map((t) => ({ nome: t.nome, descricao: t.descricao ?? null, validadeMeses: t.validadeMeses ?? null })),
      skipDuplicates: true,
    })
  }

  // 2) Preenche descrição/validade das que já existiam sem esses dados (sem sobrescrever edições)
  for (const t of TREINAMENTOS_PADRAO) {
    const e = porNome.get(t.nome)
    if (e && ((e.descricao == null && t.descricao) || (e.validadeMeses == null && t.validadeMeses != null))) {
      await prisma.treinamentoCatalogo.update({
        where: { id: e.id },
        data: {
          ...(e.descricao == null && t.descricao ? { descricao: t.descricao } : {}),
          ...(e.validadeMeses == null && t.validadeMeses != null ? { validadeMeses: t.validadeMeses } : {}),
        },
      })
    }
  }

  // 3) Garante que treinamentos já usados (em registros/funções) existam no catálogo
  const usadosFunc = await prisma.funcionarioTreinamento.findMany({ select: { nome: true }, distinct: ['nome'] })
  const funcoes = await prisma.funcao.findMany({ select: { treinamentos: true } })
  const extras = new Set<string>()
  usadosFunc.forEach((u) => { if (u.nome) extras.add(u.nome) })
  funcoes.forEach((f) => f.treinamentos.forEach((n) => { if (n) extras.add(n) }))
  const faltantes = Array.from(extras).filter((n) => !porNome.has(n) && !TREINAMENTOS_PADRAO.some((t) => t.nome === n))
  if (faltantes.length > 0) {
    await prisma.treinamentoCatalogo.createMany({ data: faltantes.map((nome) => ({ nome })), skipDuplicates: true })
  }

  const treinamentos = await prisma.treinamentoCatalogo.findMany({ orderBy: { nome: 'asc' } })
  return apiSuccess(treinamentos)
}

// POST /api/treinamentos — inclui um novo treinamento no catálogo
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const nome = parsed.data.nome.trim()
  const existente = await prisma.treinamentoCatalogo.findUnique({ where: { nome } })
  if (existente) return apiSuccess(existente, 200)

  const created = await prisma.treinamentoCatalogo.create({
    data: { nome, descricao: parsed.data.descricao ?? null, validadeMeses: parsed.data.validadeMeses ?? null },
  })
  return apiSuccess(created, 201)
}
