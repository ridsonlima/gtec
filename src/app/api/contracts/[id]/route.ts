import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

function buildContractData(body: any) {
  const startDate = body.startDate ? new Date(body.startDate) : null
  const endDate = body.endDate ? new Date(body.endDate) : null
  const proposalDate = body.proposalDate ? new Date(body.proposalDate) : null

  return {
    areaId: body.areaId,
    number: body.number,
    name: body.name,
    client: body.client,
    contractType: body.contractType || null,
    description: body.object || body.description || null,
    estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null,
    startDate,
    endDate,
    responsibleId: body.responsibleId || null,
    status: body.status || 'active',
    executionModality: body.executionModality || undefined,
    physicalProgress: body.physicalProgress === '' || body.physicalProgress == null ? null : Number(body.physicalProgress),
    financialProgress: body.financialProgress === '' || body.financialProgress == null ? null : Number(body.financialProgress),
    riskNotes: body.riskNotes || null,
    proposalDate,
    readjustmentCount: body.readjustmentCount != null && body.readjustmentCount !== '' ? Number(body.readjustmentCount) : undefined,
    readjustmentIndex: body.readjustmentIndex || null,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { area: true, responsible: { select: { id: true, name: true } } },
  })
  if (!contract) return apiError('Contrato nao encontrado', 404)
  if (!canAccessArea(session, contract.areaId)) return apiError('Sem acesso', 403)

  return apiSuccess(contract)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissao', 403)

  const current = await prisma.contract.findUnique({ where: { id: params.id } })
  if (!current) return apiError('Contrato nao encontrado', 404)
  if (!canAccessArea(session, current.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const updated = await prisma.contract.update({
    where: { id: params.id },
    data: buildContractData(body),
  })

  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)
  if (session.user.role !== 'master') return apiError('Apenas master pode excluir contratos', 403)

  const id = params.id
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          reports: true, demands: true, medicoes: true, fechamentosMensais: true,
          medicoesLocacao: true, contractPartners: true, contractors: true,
          auditoriasVisita: true, alocacoesAtivos: true, funcionarios: true,
        },
      },
    },
  })
  if (!contract) return apiError('Contrato nao encontrado', 404)

  const c = contract._count
  // Bloqueia exclusão se houver dados operacionais/financeiros relevantes
  const bloqueios: string[] = []
  if (c.reports)            bloqueios.push(`${c.reports} relatório(s)`)
  if (c.demands)            bloqueios.push(`${c.demands} demanda(s)`)
  if (c.medicoes)           bloqueios.push(`${c.medicoes} medição(ões)`)
  if (c.medicoesLocacao)    bloqueios.push(`${c.medicoesLocacao} medição(ões) de locação`)
  if (c.fechamentosMensais) bloqueios.push(`${c.fechamentosMensais} fechamento(s) mensal(is)`)
  if (c.contractPartners)   bloqueios.push(`${c.contractPartners} parceiro(s)`)
  if (c.contractors)        bloqueios.push(`${c.contractors} empreiteiro(s)`)
  if (c.auditoriasVisita)   bloqueios.push(`${c.auditoriasVisita} auditoria(s)`)
  if (bloqueios.length > 0) {
    return apiError(
      `Este contrato possui registros vinculados (${bloqueios.join(', ')}). Remova-os antes de excluir.`,
      400,
    )
  }

  try {
    // Limpa vínculos "leves" e exclui o contrato numa transação
    await prisma.$transaction([
      // Desvincula funcionários (mantém o cadastro, só remove a alocação)
      prisma.funcionario.updateMany({ where: { contratoId: id }, data: { contratoId: null } }),
      // Remove alocações de ativos e anexos do contrato
      prisma.alocacaoAtivo.deleteMany({ where: { contratoId: id } }),
      prisma.attachment.deleteMany({ where: { objectType: 'contract', objectId: id } }),
      prisma.evidenceRequest.deleteMany({ where: { objectType: 'contract', objectId: id } }),
      prisma.contract.delete({ where: { id } }),
    ])
  } catch (e) {
    console.error('[DELETE /api/contracts/[id]]', e)
    return apiError('Não foi possível excluir: ainda há registros vinculados ao contrato.', 400)
  }

  return apiSuccess({ deleted: true })
}
