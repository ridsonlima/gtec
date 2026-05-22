import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// PATCH /api/frota/medicoes/[id]/itens/[itemId]  — ajuste manual de dias/valor
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (!['rascunho', 'rejeitada'].includes(medicao.status))
    return apiError('Só é possível editar itens em rascunho ou rejeitadas', 400)

  const item = await prisma.medicaoLocacaoItem.findUnique({ where: { id: params.itemId } })
  if (!item || item.medicaoId !== params.id) return apiError('Item não encontrado', 404)

  const body = await req.json()

  const diasAtivos    = body.diasAtivos    != null ? Number(body.diasAtivos)    : item.diasAtivos
  const valorUnitario = body.valorUnitario != null ? Number(body.valorUnitario) : item.valorUnitario
  const totalItem     = Number((diasAtivos * valorUnitario).toFixed(2))

  await prisma.medicaoLocacaoItem.update({
    where: { id: params.itemId },
    data: {
      diasAtivos,
      valorUnitario,
      totalItem,
      observacoes: body.observacoes !== undefined ? body.observacoes : item.observacoes,
    },
  })

  // recalcula total da medição
  const todosItens = await prisma.medicaoLocacaoItem.findMany({ where: { medicaoId: params.id } })
  const novoTotal  = todosItens.reduce((acc, i) => acc + i.totalItem, 0)
  await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: { totalGeral: Number(novoTotal.toFixed(2)) },
  })

  return apiSuccess({ id: params.itemId, diasAtivos, valorUnitario, totalItem, novoTotal: Number(novoTotal.toFixed(2)) })
}

// DELETE /api/frota/medicoes/[id]/itens/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (!['rascunho', 'rejeitada'].includes(medicao.status))
    return apiError('Só é possível remover itens em rascunho ou rejeitadas', 400)

  const item = await prisma.medicaoLocacaoItem.findUnique({ where: { id: params.itemId } })
  if (!item || item.medicaoId !== params.id) return apiError('Item não encontrado', 404)

  await prisma.medicaoLocacaoItem.delete({ where: { id: params.itemId } })

  const todosItens = await prisma.medicaoLocacaoItem.findMany({ where: { medicaoId: params.id } })
  const novoTotal  = todosItens.reduce((acc, i) => acc + i.totalItem, 0)
  await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: { totalGeral: Number(novoTotal.toFixed(2)) },
  })

  return apiSuccess({ deleted: true, novoTotal: Number(novoTotal.toFixed(2)) })
}
