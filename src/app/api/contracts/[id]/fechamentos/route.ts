import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  const fechamentos = await prisma.fechamentoMensal.findMany({
    where: { contractId: params.id },
    orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
    include: {
      createdBy: { select: { id: true, name: true } },
      transacoes: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: [{ hipotese: 'asc' }, { createdAt: 'asc' }],
      },
      usosItens: { include: { itemLocacao: true } },
    },
  })
  return apiSuccess(fechamentos)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const contract = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!contract) return apiError('Contrato não encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const folha = body.folhaPagamento != null ? Number(body.folhaPagamento) : null
  const materiais = body.materiaisDiretos != null ? Number(body.materiaisDiretos) : null
  const pcContratual = folha != null && materiais != null ? folha + materiais : null

  const fechamento = await prisma.fechamentoMensal.upsert({
    where: {
      contractId_competenciaAno_competenciaMes: {
        contractId: params.id,
        competenciaAno: Number(body.competenciaAno),
        competenciaMes: Number(body.competenciaMes),
      },
    },
    create: {
      contractId: params.id,
      competenciaAno: Number(body.competenciaAno),
      competenciaMes: Number(body.competenciaMes),
      folhaPagamento: folha,
      materiaisDiretos: materiais,
      pcContratual,
      status: 'aberto',
      createdById: session.user.id,
    },
    update: {
      ...(body.folhaPagamento !== undefined && { folhaPagamento: folha }),
      ...(body.materiaisDiretos !== undefined && { materiaisDiretos: materiais }),
      ...(pcContratual !== null && { pcContratual }),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  await audit({
    userId: session.user.id,
    action: ACTIONS.FECHAMENTO_CREATED,
    objectType: 'fechamento',
    objectId: fechamento.id,
    metadata: {
      contractId: params.id,
      competencia: `${body.competenciaMes}/${body.competenciaAno}`,
      folhaPagamento: folha,
      materiaisDiretos: materiais,
    },
  })

  return apiSuccess(fechamento, 201)
}
