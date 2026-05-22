import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string; fechId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const fech = await prisma.fechamentoMensal.findUnique({
    where: { id: params.fechId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!fech || fech.contractId !== params.id) return apiError('Fechamento não encontrado', 404)
  if (!canAccessArea(session, fech.contract.areaId)) return apiError('Sem acesso', 403)

  const usos = await prisma.usoItemLocacao.findMany({
    where: { fechamentoId: params.fechId },
    include: { itemLocacao: true },
    orderBy: { createdAt: 'asc' },
  })
  return apiSuccess(usos)
}

export async function POST(req: NextRequest, { params }: { params: { id: string; fechId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const fech = await prisma.fechamentoMensal.findUnique({
    where: { id: params.fechId },
    include: { contract: { select: { areaId: true } } },
  })
  if (!fech || fech.contractId !== params.id) return apiError('Fechamento não encontrado', 404)
  if (!canAccessArea(session, fech.contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const item = await prisma.itemLocacao.findUnique({ where: { id: body.itemLocacaoId } })
  if (!item) return apiError('Item não encontrado', 404)

  const horasOuKm = Number(body.horasOuKm)
  const franquia = item.franquiaMensal
  const excedente = Math.max(0, horasOuKm - 0) * item.valorExcedente // excess on top of franchise
  // franchise covers the base; excess = usage beyond what the franchise allows
  // In practice: franchise = fixed monthly fee; any extra hours/km = extra charge
  const valorExcedente = horasOuKm > 0 ? excedente : 0
  const valorTotal = franquia + valorExcedente

  const uso = await prisma.usoItemLocacao.upsert({
    where: { fechamentoId_itemLocacaoId: { fechamentoId: params.fechId, itemLocacaoId: body.itemLocacaoId } },
    create: {
      fechamentoId: params.fechId,
      itemLocacaoId: body.itemLocacaoId,
      horasOuKm,
      valorFranquia: franquia,
      valorExcedente: Number(body.valorExcedente ?? valorExcedente),
      valorTotal: Number(body.valorTotal ?? valorTotal),
    },
    update: {
      horasOuKm,
      valorFranquia: franquia,
      valorExcedente: Number(body.valorExcedente ?? valorExcedente),
      valorTotal: Number(body.valorTotal ?? valorTotal),
    },
    include: { itemLocacao: true },
  })

  return apiSuccess(uso, 201)
}
