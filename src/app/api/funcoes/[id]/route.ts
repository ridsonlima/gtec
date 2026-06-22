import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

type Params = { params: { id: string } }

const PatchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  ativo: z.boolean().optional(),
  treinamentos: z.array(z.string().max(120)).optional(),
})

// PATCH /api/funcoes/[id] — edita; renomear propaga para o cargo dos funcionários
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const funcao = await prisma.funcao.findUnique({ where: { id: params.id } })
  if (!funcao) return apiError('Função não encontrada', 404)

  const d = parsed.data
  const novoNome = d.nome?.trim()

  if (novoNome && novoNome !== funcao.nome) {
    const jaExiste = await prisma.funcao.findUnique({ where: { nome: novoNome } })
    if (jaExiste && jaExiste.id !== params.id) return apiError('Já existe uma função com esse nome.', 400)
    await prisma.funcionario.updateMany({ where: { cargo: funcao.nome }, data: { cargo: novoNome } })
  }

  const updated = await prisma.funcao.update({
    where: { id: params.id },
    data: {
      ...(novoNome !== undefined && { nome: novoNome }),
      ...(d.ativo !== undefined && { ativo: d.ativo }),
      ...(d.treinamentos !== undefined && { treinamentos: d.treinamentos }),
    },
  })
  return apiSuccess(updated)
}

// DELETE /api/funcoes/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const funcao = await prisma.funcao.findUnique({ where: { id: params.id } })
  if (!funcao) return apiError('Função não encontrada', 404)

  const emUso = await prisma.funcionario.count({ where: { cargo: funcao.nome } })
  if (emUso > 0) {
    return apiError(`Esta função está vinculada a ${emUso} funcionário(s). Reatribua-os antes de remover.`, 400)
  }

  await prisma.funcao.delete({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
