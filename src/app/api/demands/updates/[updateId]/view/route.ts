import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST — marca um update como visto pelo usuário atual
export async function POST(
  _req: NextRequest,
  { params }: { params: { updateId: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  await prisma.demandUpdateView.upsert({
    where: { updateId_userId: { updateId: params.updateId, userId: session.user.id } },
    create: { updateId: params.updateId, userId: session.user.id },
    update: { seenAt: new Date() },
  })

  return apiSuccess({ ok: true })
}
