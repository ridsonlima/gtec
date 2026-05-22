import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/ordens-servico/[id]/cancelar
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin'].includes(session.user.role))
    return apiError('Apenas admin ou master pode cancelar OS', 403)

  const os = await prisma.ordemServico.findUnique({
    where: { id: params.id },
    include: { ativo: true },
  })
  if (!os) return apiError('Ordem de serviço não encontrada', 404)
  if (['concluida', 'cancelada'].includes(os.status))
    return apiError('OS já encerrada', 400)

  const body = await req.json().catch(() => ({}))

  // verifica se há outras OS ativas antes de liberar o ativo
  const outrasOsAtivas = await prisma.ordemServico.count({
    where: {
      ativoId: os.ativoId,
      id: { not: params.id },
      status: { in: ['aberta', 'em_execucao'] },
    },
  })

  const novoStatusAtivo = outrasOsAtivas === 0 ? 'disponivel' : 'manutencao'

  await prisma.$transaction([
    prisma.ordemServico.update({
      where: { id: params.id },
      data: {
        status: 'cancelada',
        observacoes: body.motivo
          ? `CANCELADA: ${body.motivo}${os.observacoes ? `\n${os.observacoes}` : ''}`
          : os.observacoes,
      },
    }),
    prisma.ativo.update({
      where: { id: os.ativoId },
      data: { status: novoStatusAtivo },
    }),
  ])

  return apiSuccess({ cancelada: true, novoStatusAtivo })
}
