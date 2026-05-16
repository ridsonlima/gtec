import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; cpId: string; instrId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const instrumento = await prisma.instrumentoFiscal.findUnique({
    where: { id: params.instrId },
    include: { contractPartner: { include: { contract: { select: { areaId: true } } } } },
  })
  if (!instrumento || instrumento.contractPartnerId !== params.cpId) return apiError('Instrumento não encontrado', 404)
  if (!canAccessArea(session, instrumento.contractPartner.contract.areaId)) return apiError('Sem acesso', 403)

  await prisma.instrumentoFiscal.delete({ where: { id: params.instrId } })
  return apiSuccess({ deleted: true })
}
