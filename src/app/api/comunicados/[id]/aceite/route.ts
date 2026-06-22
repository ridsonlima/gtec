import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/comunicados/[id]/aceite — registra leitura e/ou ciência do usuário
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const comunicado = await prisma.comunicado.findUnique({ where: { id: params.id } })
  if (!comunicado) return apiError('Comunicado não encontrado', 404)

  const leitura = await prisma.comunicadoLeitura.upsert({
    where: { comunicadoId_userId: { comunicadoId: params.id, userId: session.user.id } },
    create: {
      comunicadoId: params.id,
      userId: session.user.id,
      aceiteEm: new Date(),
    },
    update: {
      aceiteEm: new Date(),
    },
  })

  return apiSuccess(leitura)
}
