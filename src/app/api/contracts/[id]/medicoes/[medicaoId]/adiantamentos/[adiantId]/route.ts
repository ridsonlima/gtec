import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; medicaoId: string; adiantId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const adiantamento = await prisma.adiantamento.findUnique({
    where: { id: params.adiantId },
    include: { medicao: { include: { contract: { select: { areaId: true } } } } },
  })
  if (!adiantamento) return apiError('Adiantamento não encontrado', 404)
  if (adiantamento.medicaoId !== params.medicaoId) return apiError('Adiantamento não pertence a esta medição', 400)
  if (!canAccessArea(session, adiantamento.medicao.contract.areaId)) return apiError('Sem acesso', 403)

  await prisma.adiantamento.delete({ where: { id: params.adiantId } })
  return apiSuccess({ deleted: true })
}
