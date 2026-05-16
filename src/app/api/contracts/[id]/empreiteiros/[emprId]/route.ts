import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; emprId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const contractor = await prisma.contractor.findUnique({
    where: { id: params.emprId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!contractor) return apiError('Empreiteiro não encontrado', 404)
  if (!canAccessArea(session, contractor.contract.areaId)) return apiError('Sem acesso', 403)
  if (contractor.contractId !== params.id) return apiError('Empreiteiro não pertence a este contrato', 400)

  await prisma.contractor.delete({ where: { id: params.emprId } })
  return apiSuccess({ deleted: true })
}
