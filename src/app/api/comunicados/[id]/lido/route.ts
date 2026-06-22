import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/comunicados/[id]/lido — registra que o usuário LEU (sem exigir aceite).
// Usado pelo modal "O que há de novo" para a novidade não aparecer de novo.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const leitura = await prisma.comunicadoLeitura.upsert({
    where: { comunicadoId_userId: { comunicadoId: params.id, userId: session.user.id } },
    create: { comunicadoId: params.id, userId: session.user.id, lidoEm: new Date() },
    update: { lidoEm: new Date() },
  })

  return apiSuccess(leitura)
}
