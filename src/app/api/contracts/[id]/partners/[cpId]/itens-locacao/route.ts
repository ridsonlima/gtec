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

export async function GET(_req: NextRequest, { params }: { params: { id: string; cpId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { error } = await getCpOrFail(params.cpId, params.id, session)
  if (error) return error

  const itens = await prisma.itemLocacao.findMany({
    where: { contractPartnerId: params.cpId },
    orderBy: { createdAt: 'asc' },
  })
  return apiSuccess(itens)
}

export async function POST(req: NextRequest, { params }: { params: { id: string; cpId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getCpOrFail(params.cpId, params.id, session)
  if (error) return error

  const body = await req.json()
  const item = await prisma.itemLocacao.create({
    data: {
      contractPartnerId: params.cpId,
      descricao: body.descricao,
      placa: body.placa || null,
      franquiaMensal: Number(body.franquiaMensal),
      unidadeExcedente: body.unidadeExcedente ?? 'hora',
      valorExcedente: Number(body.valorExcedente),
    },
  })
  return apiSuccess(item, 201)
}
