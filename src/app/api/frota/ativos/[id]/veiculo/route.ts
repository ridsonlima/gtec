import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/frota/ativos/[id]/veiculo — condutores, multas, documentos e checklists do veículo
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const ativo = await prisma.ativo.findUnique({
    where: { id: params.id },
    select: { id: true, condutorAtualId: true },
  })
  if (!ativo) return apiError('Veículo não encontrado', 404)

  const [condutores, multas, documentos, checklists] = await Promise.all([
    prisma.condutor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.veiculoMulta.findMany({
      where: { ativoId: params.id },
      orderBy: { dataInfracao: 'desc' },
      include: { condutor: { select: { id: true, nome: true } } },
    }),
    prisma.veiculoDocumento.findMany({ where: { ativoId: params.id }, orderBy: { vencimento: 'asc' } }),
    prisma.veiculoChecklist.findMany({
      where: { ativoId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        solicitante: { select: { id: true, name: true } },
        aprovador: { select: { id: true, name: true } },
        fotos: true,
      },
    }),
  ])

  return apiSuccess({ condutorAtualId: ativo.condutorAtualId, condutores, multas, documentos, checklists })
}
