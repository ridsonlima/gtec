import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

async function getCpOrFail(cpId: string, contractId: string, session: any) {
  const cp = await prisma.contractPartner.findUnique({
    where: { id: cpId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!cp) return { error: apiError('Vínculo não encontrado', 404) }
  if (cp.contractId !== contractId) return { error: apiError('Vínculo não pertence a este contrato', 400) }
  if (!canAccessArea(session, cp.contract.areaId)) return { error: apiError('Sem acesso', 403) }
  return { cp }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; cpId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getCpOrFail(params.cpId, params.id, session)
  if (error) return error

  const body = await req.json()
  const updated = await prisma.contractPartner.update({
    where: { id: params.cpId },
    data: { percentageTotal: Number(body.percentageTotal) },
    include: { empresaParceira: true, instrumentos: true },
  })

  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; cpId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getCpOrFail(params.cpId, params.id, session)
  if (error) return error

  await prisma.contractPartner.delete({ where: { id: params.cpId } })
  return apiSuccess({ deleted: true })
}
