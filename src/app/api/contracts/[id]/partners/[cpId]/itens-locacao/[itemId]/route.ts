import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

async function getItemOrFail(itemId: string, cpId: string, contractId: string, session: any) {
  const item = await prisma.itemLocacao.findUnique({
    where: { id: itemId },
    include: { contractPartner: { include: { contract: { select: { areaId: true } } } } },
  })
  if (!item) return { error: apiError('Item não encontrado', 404) }
  if (item.contractPartnerId !== cpId) return { error: apiError('Item não pertence a este parceiro', 400) }
  if (item.contractPartner.contractId !== contractId) return { error: apiError('Contrato inválido', 400) }
  if (!canAccessArea(session, item.contractPartner.contract.areaId)) return { error: apiError('Sem acesso', 403) }
  return { item }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; cpId: string; itemId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getItemOrFail(params.itemId, params.cpId, params.id, session)
  if (error) return error

  const body = await req.json()
  const updated = await prisma.itemLocacao.update({
    where: { id: params.itemId },
    data: {
      ...(body.descricao !== undefined && { descricao: body.descricao }),
      ...(body.placa !== undefined && { placa: body.placa || null }),
      ...(body.franquiaMensal !== undefined && { franquiaMensal: Number(body.franquiaMensal) }),
      ...(body.unidadeExcedente !== undefined && { unidadeExcedente: body.unidadeExcedente }),
      ...(body.valorExcedente !== undefined && { valorExcedente: Number(body.valorExcedente) }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; cpId: string; itemId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getItemOrFail(params.itemId, params.cpId, params.id, session)
  if (error) return error

  await prisma.itemLocacao.delete({ where: { id: params.itemId } })
  return apiSuccess({ deleted: true })
}
