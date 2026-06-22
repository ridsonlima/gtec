import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { recalcFechamento } from '@/lib/recalc-fechamento'
import { audit, ACTIONS } from '@/lib/audit'

async function getFechOrFail(fechId: string, contractId: string, session: any) {
  const fech = await prisma.fechamentoMensal.findUnique({
    where: { id: fechId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!fech) return { error: apiError('Fechamento não encontrado', 404) }
  if (fech.contractId !== contractId) return { error: apiError('Fechamento não pertence a este contrato', 400) }
  if (!canAccessArea(session, fech.contract.areaId)) return { error: apiError('Sem acesso', 403) }
  return { fech }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; fechId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { error } = await getFechOrFail(params.fechId, params.id, session)
  if (error) return error

  const transacoes = await prisma.transacao.findMany({
    where: { fechamentoId: params.fechId },
    orderBy: [{ hipotese: 'asc' }, { createdAt: 'asc' }],
    include: { createdBy: { select: { id: true, name: true } } },
  })
  return apiSuccess(transacoes)
}

export async function POST(req: NextRequest, { params }: { params: { id: string; fechId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const { error } = await getFechOrFail(params.fechId, params.id, session)
  if (error) return error

  const body = await req.json()
  if (!body.descricao || !body.valor || !body.hipotese) return apiError('descricao, valor e hipotese são obrigatórios', 400)
  if (body.hipotese === 4) return apiError('Hipótese 4 é proibida: Empresa A não pode receber pagamento sem NF', 400)
  if (![1, 2, 3, 5, 6, 7, 8].includes(Number(body.hipotese))) return apiError('Hipótese inválida', 400)

  const tx = await prisma.transacao.create({
    data: {
      fechamentoId: params.fechId,
      hipotese: Number(body.hipotese),
      descricao: body.descricao,
      valor: Number(body.valor),
      beneficiario: body.beneficiario || null,
      dataPagamento: body.dataPagamento ? new Date(body.dataPagamento) : null,
      nfNumero: body.nfNumero || null,
      observacoes: body.observacoes || null,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  await recalcFechamento(params.fechId)

  await audit({
    userId: session.user.id,
    action: ACTIONS.TRANSACAO_CREATED,
    objectType: 'transacao',
    objectId: tx.id,
    metadata: {
      contractId: params.id,
      fechamentoId: params.fechId,
      hipotese: tx.hipotese,
      valor: tx.valor,
      beneficiario: tx.beneficiario,
      nfNumero: tx.nfNumero,
    },
  })

  return apiSuccess(tx, 201)
}
