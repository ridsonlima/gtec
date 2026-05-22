import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { recalcFechamento } from '@/lib/recalc-fechamento'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; fechId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const fech = await prisma.fechamentoMensal.findUnique({
    where: { id: params.fechId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!fech) return apiError('Fechamento não encontrado', 404)
  if (fech.contractId !== params.id) return apiError('Fechamento não pertence a este contrato', 400)
  if (!canAccessArea(session, fech.contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const data: any = {}

  if (body.ndNumero !== undefined) data.ndNumero = body.ndNumero || null
  if (body.ndEmissao !== undefined) data.ndEmissao = body.ndEmissao ? new Date(body.ndEmissao) : null
  if (body.pcReal !== undefined) data.pcReal = body.pcReal != null ? Number(body.pcReal) : null
  if (body.nfAdmNumero !== undefined) data.nfAdmNumero = body.nfAdmNumero || null
  if (body.nfAdmValor !== undefined) data.nfAdmValor = body.nfAdmValor != null ? Number(body.nfAdmValor) : null
  if (body.adiantEmpresaA !== undefined) data.adiantEmpresaA = body.adiantEmpresaA != null ? Number(body.adiantEmpresaA) : null
  if (body.observacoes !== undefined) data.observacoes = body.observacoes || null
  if (body.status !== undefined) data.status = body.status

  await prisma.fechamentoMensal.update({ where: { id: params.fechId }, data })

  // Recalcula tudo a partir das transações (atualiza pcContratual, ndContratual, meta 90%, status)
  await recalcFechamento(params.fechId)

  const updated = await prisma.fechamentoMensal.findUnique({
    where: { id: params.fechId },
    include: {
      createdBy: { select: { id: true, name: true } },
      transacoes: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: [{ hipotese: 'asc' }, { createdAt: 'asc' }] },
      usosItens: { include: { itemLocacao: true } },
    },
  })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; fechId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const fech = await prisma.fechamentoMensal.findUnique({
    where: { id: params.fechId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!fech) return apiError('Fechamento não encontrado', 404)
  if (fech.contractId !== params.id) return apiError('Fechamento não pertence a este contrato', 400)
  if (!canAccessArea(session, fech.contract.areaId)) return apiError('Sem acesso', 403)

  await prisma.fechamentoMensal.delete({ where: { id: params.fechId } })
  return apiSuccess({ deleted: true })
}
