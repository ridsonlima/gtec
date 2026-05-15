import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  })
  if (!notification) return apiError('Não encontrado', 404)
  if (notification.userId !== session.user.id) return apiError('Sem permissão', 403)

  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { isRead: true, readAt: new Date() },
  })

  return apiSuccess(updated)
}
