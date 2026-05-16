import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string; medicaoId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const medicao = await prisma.medicao.findUnique({
    where: { id: params.medicaoId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!medicao || medicao.contractId !== params.id) return apiError('Medição não encontrada', 404)
  if (!canAccessArea(session, medicao.contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const adiantamento = await prisma.adiantamento.create({
    data: {
      medicaoId: params.medicaoId,
      valor: Number(body.valor),
      dataAdiantamento: new Date(body.dataAdiantamento),
      descricao: body.descricao || null,
      createdById: session.user.id,
    },
  })

  return apiSuccess(adiantamento, 201)
}
