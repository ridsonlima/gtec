import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { recalcFechamento } from '@/lib/recalc-fechamento'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; fechId: string; txId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const tx = await prisma.transacao.findUnique({
    where: { id: params.txId },
    include: { fechamento: { include: { contract: { select: { areaId: true } } } } },
  })
  if (!tx) return apiError('Transação não encontrada', 404)
  if (tx.fechamentoId !== params.fechId) return apiError('Transação não pertence a este fechamento', 400)
  if (!canAccessArea(session, tx.fechamento.contract.areaId)) return apiError('Sem acesso', 403)

  await prisma.transacao.delete({ where: { id: params.txId } })
  await recalcFechamento(params.fechId)

  return apiSuccess({ deleted: true })
}
