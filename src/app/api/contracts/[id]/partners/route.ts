import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  const partners = await prisma.contractPartner.findMany({
    where: { contractId: params.id },
    include: {
      empresaParceira: true,
      instrumentos: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return apiSuccess(partners)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  const existing = await prisma.contractPartner.count({ where: { contractId: params.id } })
  if (existing >= 2) return apiError('Máximo de 2 parceiros por contrato', 400)

  const body = await req.json()
  const cp = await prisma.contractPartner.create({
    data: {
      contractId: params.id,
      empresaParceiraId: body.empresaParceiraId,
      percentageTotal: Number(body.percentageTotal),
    },
    include: { empresaParceira: true, instrumentos: true },
  })

  return apiSuccess(cp, 201)
}
