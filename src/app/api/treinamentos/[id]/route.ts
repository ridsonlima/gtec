import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

type Params = { params: { id: string } }

const PatchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  descricao: z.string().max(400).nullable().optional(),
  validadeMeses: z.number().int().min(0).max(120).nullable().optional(),
  ativo: z.boolean().optional(),
})

// PATCH /api/treinamentos/[id] — renomear propaga para funções e registros
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const treino = await prisma.treinamentoCatalogo.findUnique({ where: { id: params.id } })
  if (!treino) return apiError('Treinamento não encontrado', 404)

  const d = parsed.data
  const novoNome = d.nome?.trim()

  if (novoNome && novoNome !== treino.nome) {
    const jaExiste = await prisma.treinamentoCatalogo.findUnique({ where: { nome: novoNome } })
    if (jaExiste && jaExiste.id !== params.id) return apiError('Já existe um treinamento com esse nome.', 400)

    // Propaga o novo nome nos registros dos funcionários
    await prisma.funcionarioTreinamento.updateMany({ where: { nome: treino.nome }, data: { nome: novoNome } })
    // Propaga nas funções (array de strings)
    const funcoes = await prisma.funcao.findMany({ where: { treinamentos: { has: treino.nome } }, select: { id: true, treinamentos: true } })
    for (const f of funcoes) {
      await prisma.funcao.update({
        where: { id: f.id },
        data: { treinamentos: f.treinamentos.map((n) => (n === treino.nome ? novoNome : n)) },
      })
    }
  }

  const updated = await prisma.treinamentoCatalogo.update({
    where: { id: params.id },
    data: {
      ...(novoNome !== undefined && { nome: novoNome }),
      ...(d.descricao !== undefined && { descricao: d.descricao }),
      ...(d.validadeMeses !== undefined && { validadeMeses: d.validadeMeses }),
      ...(d.ativo !== undefined && { ativo: d.ativo }),
    },
  })
  return apiSuccess(updated)
}

// DELETE /api/treinamentos/[id] — remove do catálogo (não apaga registros existentes)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const treino = await prisma.treinamentoCatalogo.findUnique({ where: { id: params.id } })
  if (!treino) return apiError('Treinamento não encontrado', 404)

  // Remove o treinamento das funções que o exigem
  const funcoes = await prisma.funcao.findMany({ where: { treinamentos: { has: treino.nome } }, select: { id: true, treinamentos: true } })
  for (const f of funcoes) {
    await prisma.funcao.update({
      where: { id: f.id },
      data: { treinamentos: f.treinamentos.filter((n) => n !== treino.nome) },
    })
  }

  await prisma.treinamentoCatalogo.delete({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
