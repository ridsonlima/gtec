import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// POST /api/frota/ordens-servico/[id]/concluir
// Conclui a OS e libera o ativo para disponível (ou alocado, se houver alocação pendente)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const os = await prisma.ordemServico.findUnique({
    where: { id: params.id },
    include: { ativo: true, createdBy: { select: { id: true } } },
  })
  if (!os) return apiError('Ordem de serviço não encontrada', 404)
  if (!['aberta', 'em_execucao'].includes(os.status))
    return apiError('OS já encerrada', 400)

  const body = await req.json()
  const { observacoes, custo, executante } = body

  // verifica se ainda existe alguma OS aberta/em execução para este ativo
  const outrasOsAtivas = await prisma.ordemServico.count({
    where: {
      ativoId: os.ativoId,
      id: { not: params.id },
      status: { in: ['aberta', 'em_execucao'] },
    },
  })

  // só libera o ativo se for a única OS ativa
  const novoStatusAtivo = outrasOsAtivas === 0 ? 'disponivel' : 'manutencao'

  await prisma.$transaction([
    prisma.ordemServico.update({
      where: { id: params.id },
      data: {
        status: 'concluida',
        dataConclusao: new Date(),
        ...(observacoes !== undefined && { observacoes }),
        ...(custo != null && { custo: Number(custo) }),
        ...(executante !== undefined && { executante }),
      },
    }),
    prisma.ativo.update({
      where: { id: os.ativoId },
      data: { status: novoStatusAtivo },
    }),
  ])

  // notifica quem abriu a OS
  if (os.createdBy.id !== session.user.id) {
    await createNotification({
      userId: os.createdBy.id,
      type: 'os_concluida',
      title: `OS concluída — ${os.ativo.tag}`,
      body: `${session.user.name} concluiu: ${os.descricao}`,
      objectType: 'ordem_servico',
      objectId: params.id,
    })
  }

  // notifica gestores se ativo volta disponível após corretiva
  if (os.tipo === 'corretiva' && novoStatusAtivo === 'disponivel') {
    const gestores = await prisma.user.findMany({
      where: { role: { in: ['master', 'admin', 'director'] }, isActive: true },
      select: { id: true },
    })
    if (gestores.length) {
      await prisma.notification.createMany({
        data: gestores.map((g) => ({
          userId: g.id,
          type: 'ativo_disponivel',
          title: `Ativo disponível — ${os.ativo.tag}`,
          body: `${os.ativo.descricao} voltou ao status disponível após manutenção corretiva`,
          objectType: 'ativo',
          objectId: os.ativoId,
        })),
        skipDuplicates: true,
      })
    }
  }

  return apiSuccess({ concluida: true, novoStatusAtivo })
}
