import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const areaId = searchParams.get('areaId')

  // Build user list — if areaId given, filter to users with scope on that area
  // plus all directors/admins (who have global access)
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: ['admin', 'director'] } },
        ...(areaId
          ? [{ areaScopes: { some: { areaId } } }]
          : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return apiSuccess(users)
}
