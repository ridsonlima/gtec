import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

type Params = { params: { id: string } }

const PatchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  tipo: z.enum(['propria', 'terceira']).nullable().optional(),
  cnpj: z.string().max(20).nullable().optional(),
  ativo: z.boolean().optional(),
})

// PATCH /api/empresas/[id] — edita; renomear propaga para os funcionários
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const empresa = await prisma.empresaFuncionario.findUnique({ where: { id: params.id } })
  if (!empresa) return apiError('Empresa não encontrada', 404)

  const d = parsed.data
  const novoNome = d.nome?.trim()

  // Se renomeou, propaga o novo nome para todos os funcionários que usam o nome antigo
  if (novoNome && novoNome !== empresa.nome) {
    const jaExiste = await prisma.empresaFuncionario.findUnique({ where: { nome: novoNome } })
    if (jaExiste && jaExiste.id !== params.id) {
      return apiError('Já existe uma empresa com esse nome.', 400)
    }
    await prisma.funcionario.updateMany({
      where: { empresa: empresa.nome },
      data: { empresa: novoNome },
    })
  }

  const updated = await prisma.empresaFuncionario.update({
    where: { id: params.id },
    data: {
      ...(novoNome !== undefined && { nome: novoNome }),
      ...(d.tipo !== undefined && { tipo: d.tipo }),
      ...(d.cnpj !== undefined && { cnpj: d.cnpj }),
      ...(d.ativo !== undefined && { ativo: d.ativo }),
    },
  })
  return apiSuccess(updated)
}

// DELETE /api/empresas/[id] — remove do cadastro (não apaga funcionários)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const empresa = await prisma.empresaFuncionario.findUnique({ where: { id: params.id } })
  if (!empresa) return apiError('Empresa não encontrada', 404)

  const emUso = await prisma.funcionario.count({ where: { empresa: empresa.nome } })
  if (emUso > 0) {
    return apiError(`Esta empresa está vinculada a ${emUso} funcionário(s). Reatribua-os antes de remover.`, 400)
  }

  await prisma.empresaFuncionario.delete({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
