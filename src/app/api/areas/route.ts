import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { getUserAreaIds } from '@/lib/permissions'

// GET /api/areas
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const allowedAreaIds = getUserAreaIds(session)

  const areas = await prisma.area.findMany({
    where: {
      isActive: true,
      ...(allowedAreaIds ? { id: { in: allowedAreaIds } } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          reports: { where: { status: 'published' } },
          contracts: { where: { status: { not: 'closed' } } },
          demands: { where: { status: { notIn: ['completed', 'cancelled'] } } },
        },
      },
    },
  })

  return apiSuccess(areas)
}
