import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { partner: true },
  })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  return apiSuccess(contract.partner)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const partner = await prisma.partner.upsert({
    where: { contractId: params.id },
    create: {
      contractId: params.id,
      name: body.name,
      cnpj: body.cnpj || null,
      contactName: body.contactName || null,
      contactPhone: body.contactPhone || null,
      percentageGlobal: Number(body.percentageGlobal),
    },
    update: {
      name: body.name,
      cnpj: body.cnpj || null,
      contactName: body.contactName || null,
      contactPhone: body.contactPhone || null,
      percentageGlobal: Number(body.percentageGlobal),
    },
  })

  return apiSuccess(partner, 201)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  await prisma.partner.deleteMany({ where: { contractId: params.id } })
  return apiSuccess({ deleted: true })
}
