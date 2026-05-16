import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

async function getMedicaoOrFail(medicaoId: string, contractId: string, session: any) {
  const medicao = await prisma.medicao.findUnique({
    where: { id: medicaoId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!medicao) return { error: apiError('Medição não encontrada', 404) }
  if (medicao.contractId !== contractId) return { error: apiError('Medição não pertence a este contrato', 400) }
  if (!canAccessArea(session, medicao.contract.areaId)) return { error: apiError('Sem acesso', 403) }
  return { medicao }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; medicaoId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getMedicaoOrFail(params.medicaoId, params.id, session)
  if (error) return error

  const body = await req.json()
  const updated = await prisma.medicao.update({
    where: { id: params.medicaoId },
    data: {
      valorProduzido: body.valorProduzido !== undefined ? Number(body.valorProduzido) : undefined,
      valorAprovado: body.valorAprovado !== undefined ? Number(body.valorAprovado) : undefined,
      valorFaturado: body.valorFaturado !== undefined ? Number(body.valorFaturado) : undefined,
      observacoes: body.observacoes !== undefined ? (body.observacoes || null) : undefined,
    },
    include: { adiantamentos: true, createdBy: { select: { id: true, name: true } } },
  })

  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; medicaoId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getMedicaoOrFail(params.medicaoId, params.id, session)
  if (error) return error

  await prisma.medicao.delete({ where: { id: params.medicaoId } })
  return apiSuccess({ deleted: true })
}
