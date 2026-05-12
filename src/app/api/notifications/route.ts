import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/notifications
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const isRead = searchParams.get('isRead')
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '30'))

  const where: any = { userId: session.user.id }
  if (isRead === 'false') where.isRead = false
  if (isRead === 'true') where.isRead = true

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ])

  return apiSuccess({ notifications, unreadCount })
}

// POST /api/notifications/read-all
// (definido em route separada para clareza)
