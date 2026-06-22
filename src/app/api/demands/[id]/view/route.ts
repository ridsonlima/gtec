import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/demands/[id]/view — registra que o usuário viu a demanda agora
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const now = new Date()
  await prisma.demandView.upsert({
    where: { userId_demandId: { userId: session.user.id, demandId: params.id } },
    create: { userId: session.user.id, demandId: params.id, viewedAt: now },
    update: { viewedAt: now },
  })

  return apiSuccess({ ok: true })
}
