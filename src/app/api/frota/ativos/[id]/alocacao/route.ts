import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/ativos/[id]/alocacao  — alocar ativo a contrato/projeto
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const ativo = await prisma.ativo.findUnique({ where: { id: params.id } })
  if (!ativo) return apiError('Ativo não encontrado', 404)

  if (ativo.status === 'manutencao')
    return apiError('Ativo em manutenção não pode ser alocado', 400)
  if (ativo.status === 'inativo')
    return apiError('Ativo inativo não pode ser alocado', 400)

  const alocacaoAtiva = await prisma.alocacaoAtivo.findFirst({
    where: { ativoId: params.id, dataFim: null },
  })
  if (alocacaoAtiva) return apiError('Ativo já possui alocação ativa. Desaloque primeiro.', 400)

  const body = await req.json()
  if (!body.contratoId) return apiError('contratoId é obrigatório', 400)

  const contrato = await prisma.contract.findUnique({ where: { id: body.contratoId } })
  if (!contrato) return apiError('Contrato não encontrado', 404)

  const [alocacao] = await prisma.$transaction([
    prisma.alocacaoAtivo.create({
      data: {
        ativoId: params.id,
        contratoId: body.contratoId,
        projetoId: body.projetoId || null,
        dataInicio: body.dataInicio ? new Date(body.dataInicio) : new Date(),
        observacoes: body.observacoes || null,
        createdById: session.user.id,
      },
    }),
    prisma.ativo.update({
      where: { id: params.id },
      data: { status: 'alocado' },
    }),
  ])

  return apiSuccess(alocacao, 201)
}

// DELETE /api/frota/ativos/[id]/alocacao  — desalocar (encerrar alocação ativa)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const alocacaoAtiva = await prisma.alocacaoAtivo.findFirst({
    where: { ativoId: params.id, dataFim: null },
  })
  if (!alocacaoAtiva) return apiError('Nenhuma alocação ativa encontrada', 404)

  const body = await req.json().catch(() => ({}))
  const dataFim = body.dataFim ? new Date(body.dataFim) : new Date()

  await prisma.$transaction([
    prisma.alocacaoAtivo.update({
      where: { id: alocacaoAtiva.id },
      data: { dataFim },
    }),
    prisma.ativo.update({
      where: { id: params.id },
      data: { status: 'disponivel' },
    }),
  ])

  return apiSuccess({ desalocado: true, dataFim })
}

// PATCH /api/frota/ativos/[id]/alocacao  — transferir para outro contrato/projeto
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const body = await req.json()
  if (!body.contratoId) return apiError('contratoId de destino é obrigatório', 400)

  const alocacaoAtiva = await prisma.alocacaoAtivo.findFirst({
    where: { ativoId: params.id, dataFim: null },
  })
  if (!alocacaoAtiva) return apiError('Nenhuma alocação ativa para transferir', 404)

  const agora = new Date()

  await prisma.$transaction([
    // encerra a alocação atual
    prisma.alocacaoAtivo.update({
      where: { id: alocacaoAtiva.id },
      data: { dataFim: agora },
    }),
    // cria nova alocação no destino
    prisma.alocacaoAtivo.create({
      data: {
        ativoId: params.id,
        contratoId: body.contratoId,
        projetoId: body.projetoId || null,
        dataInicio: agora,
        observacoes: body.observacoes || null,
        createdById: session.user.id,
      },
    }),
  ])

  return apiSuccess({ transferido: true })
}
