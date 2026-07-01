import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/frota/ativos/[id]  — ficha completa do ativo
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const ativo = await prisma.ativo.findUnique({
    where: { id: params.id },
    include: {
      alocacoes: {
        orderBy: { dataInicio: 'desc' },
        include: {
          contrato: { select: { id: true, number: true, name: true } },
          projeto: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      ordensServico: {
        orderBy: { dataAbertura: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
      auditoriaItens: {
        orderBy: { visita: { dataVisita: 'desc' } },
        include: {
          visita: {
            select: {
              id: true,
              dataVisita: true,
              status: true,
              auditor: { select: { id: true, name: true } },
            },
          },
          pendencia: true,
        },
        take: 20,
      },
      medicaoItens: {
        orderBy: [{ medicao: { competenciaAno: 'desc' } }, { medicao: { competenciaMes: 'desc' } }],
        include: {
          medicao: {
            select: {
              id: true,
              competenciaAno: true,
              competenciaMes: true,
              status: true,
              contrato: { select: { id: true, number: true, name: true } },
            },
          },
          projeto: { select: { id: true, name: true } },
        },
        take: 24,
      },
    },
  })

  if (!ativo) return apiError('Ativo não encontrado', 404)

  return apiSuccess(ativo)
}

// PATCH /api/frota/ativos/[id]  — atualizar dados ou status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const ativo = await prisma.ativo.findUnique({ where: { id: params.id } })
  if (!ativo) return apiError('Ativo não encontrado', 404)

  const body = await req.json()

  // Não pode ir para "disponivel" se há alocação ativa
  if (body.status === 'disponivel') {
    const alocacaoAtiva = await prisma.alocacaoAtivo.findFirst({
      where: { ativoId: params.id, dataFim: null },
    })
    if (alocacaoAtiva) return apiError('Encerre a alocação ativa antes de liberar o ativo', 400)
  }

  // Não pode ir para "alocado" manualmente (só via endpoint de alocação)
  if (body.status === 'alocado') return apiError('Use o endpoint de alocação para alocar o ativo', 400)

  const updated = await prisma.ativo.update({
    where: { id: params.id },
    data: {
      ...(body.descricao !== undefined && { descricao: body.descricao }),
      ...(body.marca !== undefined && { marca: body.marca }),
      ...(body.modelo !== undefined && { modelo: body.modelo }),
      ...(body.anoFabricacao !== undefined && { anoFabricacao: body.anoFabricacao ? Number(body.anoFabricacao) : null }),
      ...(body.placa !== undefined && { placa: body.placa ? body.placa.toUpperCase().trim() : null }),
      ...(body.numeroserie !== undefined && { numeroserie: body.numeroserie }),
      ...(body.valorLocacaoMensal !== undefined && { valorLocacaoMensal: Number(body.valorLocacaoMensal) }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
      ...(body.categoria !== undefined && { categoria: body.categoria }),
      ...(body.condutorAtualId !== undefined && { condutorAtualId: body.condutorAtualId || null }),
    },
  })

  return apiSuccess(updated)
}

// DELETE /api/frota/ativos/[id]  — master ou admin
// ?force=true  → remove registros vinculados antes de excluir
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin'].includes(session.user.role))
    return apiError('Apenas master ou admin pode excluir ativos', 403)

  const force = new URL(req.url).searchParams.get('force') === 'true'

  const ativo = await prisma.ativo.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { alocacoes: true, ordensServico: true, medicaoItens: true, auditoriaItens: true } },
    },
  })
  if (!ativo) return apiError('Ativo não encontrado', 404)

  const hasLinks =
    ativo._count.alocacoes > 0 ||
    ativo._count.ordensServico > 0 ||
    ativo._count.medicaoItens > 0 ||
    ativo._count.auditoriaItens > 0

  if (hasLinks && !force) {
    return apiSuccess({
      requiresForce: true,
      counts: ativo._count,
      message: 'Ativo possui registros vinculados. Envie force=true para confirmar exclusão.',
    })
  }

  if (hasLinks && force) {
    // Remove pendências de auditoria → itens de auditoria → OS → alocações → itens de medição
    const auditItemIds = await prisma.auditoriaItem.findMany({
      where: { ativoId: params.id },
      select: { id: true },
    })
    if (auditItemIds.length > 0) {
      await prisma.pendenciaAuditoria.deleteMany({
        where: { itemId: { in: auditItemIds.map((i) => i.id) } },
      })
    }
    await prisma.auditoriaItem.deleteMany({ where: { ativoId: params.id } })
    await prisma.ordemServico.deleteMany({ where: { ativoId: params.id } })
    await prisma.alocacaoAtivo.deleteMany({ where: { ativoId: params.id } })
    await prisma.medicaoLocacaoItem.deleteMany({ where: { ativoId: params.id } })
  }

  await prisma.ativo.delete({ where: { id: params.id } })
  return apiSuccess({ deleted: true })
}
