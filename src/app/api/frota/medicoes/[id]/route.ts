import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

const INCLUDE_FULL = {
  itens: {
    include: {
      ativo: { select: { id: true, tag: true, descricao: true, categoria: true, tipo: true } },
      projeto: { select: { id: true, name: true } },
    },
    orderBy: { ativo: { tag: 'asc' } } as any,
  },
  contrato: { select: { id: true, number: true, name: true, responsible: { select: { id: true, name: true } } } },
  aprovador:  { select: { id: true, name: true } },
  supervisor: { select: { id: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
}

// GET /api/frota/medicoes/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: INCLUDE_FULL,
  })
  if (!medicao) return apiError('Medição não encontrada', 404)

  return apiSuccess(medicao)
}

// PATCH /api/frota/medicoes/[id]  — edita rascunho (observações / recalcula total)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (!['rascunho', 'rejeitada'].includes(medicao.status))
    return apiError('Só é possível editar medições em rascunho ou rejeitadas', 400)

  const body = await req.json()

  const updated = await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: {
      ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
    },
    include: INCLUDE_FULL,
  })

  return apiSuccess(updated)
}

// DELETE /api/frota/medicoes/[id]  — apenas rascunho
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (medicao.status !== 'rascunho')
    return apiError('Só é possível excluir medições em rascunho', 400)

  await prisma.medicaoLocacao.delete({ where: { id: params.id } })
  return apiSuccess({ deleted: true })
}
