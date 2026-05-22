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

  const medicoes = await prisma.medicao.findMany({
    where: { contractId: params.id },
    orderBy: [{ competenciaAno: 'asc' }, { competenciaMes: 'asc' }],
    include: {
      adiantamentos: { orderBy: { dataAdiantamento: 'asc' } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(medicoes)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const ano = Number(body.competenciaAno)
  const mes = Number(body.competenciaMes)
  const contractPartnerId: string | null = body.contractPartnerId || null

  if (mes < 1 || mes > 12) return apiError('Mês de competência inválido', 400)

  const existing = await prisma.medicao.findFirst({
    where: { contractId: params.id, contractPartnerId, competenciaAno: ano, competenciaMes: mes },
  })
  if (existing) return apiError('Já existe uma medição para este parceiro nesta competência', 400)

  const medicao = await prisma.medicao.create({
    data: {
      contractId: params.id,
      contractPartnerId,
      competenciaAno: ano,
      competenciaMes: mes,
      valorProduzido: Number(body.valorProduzido ?? 0),
      valorAprovado: Number(body.valorAprovado ?? 0),
      valorFaturado: Number(body.valorFaturado ?? 0),
      observacoes: body.observacoes || null,
      createdById: session.user.id,
    },
    include: { adiantamentos: true, createdBy: { select: { id: true, name: true } } },
  })

  return apiSuccess(medicao, 201)
}
