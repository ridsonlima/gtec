import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/ativos/alocar-lote
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const body = await req.json()
  const { ativoIds, contratoId, projetoId, dataInicio } = body

  if (!Array.isArray(ativoIds) || ativoIds.length === 0)
    return apiError('ativoIds é obrigatório', 400)
  if (!contratoId) return apiError('contratoId é obrigatório', 400)

  const contrato = await prisma.contract.findUnique({ where: { id: contratoId } })
  if (!contrato) return apiError('Contrato não encontrado', 404)

  const ativos = await prisma.ativo.findMany({
    where: { id: { in: ativoIds } },
    include: { alocacoes: { where: { dataFim: null }, take: 1 } },
  })

  const inaptos = ativos.filter(
    (a) => a.status !== 'disponivel' || a.alocacoes.length > 0,
  )
  if (inaptos.length > 0) {
    return apiError(
      `${inaptos.length} ativo(s) não estão disponíveis: ${inaptos.map((a) => a.tag).join(', ')}`,
      400,
    )
  }

  const inicio = dataInicio ? new Date(dataInicio) : new Date()

  await prisma.$transaction([
    prisma.alocacaoAtivo.createMany({
      data: ativoIds.map((id: string) => ({
        ativoId: id,
        contratoId,
        projetoId: projetoId || null,
        dataInicio: inicio,
        createdById: session.user.id,
      })),
    }),
    prisma.ativo.updateMany({
      where: { id: { in: ativoIds } },
      data: { status: 'alocado' },
    }),
  ])

  return apiSuccess({ alocados: ativoIds.length, contratoId })
}
