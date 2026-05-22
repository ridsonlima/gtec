import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { getUserAreaIds } from '@/lib/permissions'

// GET /api/areas
// ?leafOnly=true  → exclui áreas "container" (que possuem subáreas filhas)
//                   Ex.: Sala Técnica não aparece — só Planejamento e Orçamento
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const allowedAreaIds = getUserAreaIds(session)
  const leafOnly = req.nextUrl.searchParams.get('leafOnly') === 'true'

  // Se leafOnly, descobre quais IDs são pai de outras áreas e os exclui
  let excludeIds: string[] = []
  if (leafOnly) {
    const parents = await prisma.area.findMany({
      where: { parentId: { not: null } },
      select: { parentId: true },
    })
    excludeIds = Array.from(new Set(parents.map((p) => p.parentId as string)))
  }

  const areas = await prisma.area.findMany({
    where: {
      isActive: true,
      ...(allowedAreaIds ? { id: { in: allowedAreaIds } } : {}),
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          reports:   { where: { status: 'published' } },
          contracts: { where: { status: { not: 'closed' } } },
          demands:   { where: { status: { notIn: ['completed', 'cancelled'] } } },
        },
      },
    },
  })

  return apiSuccess(areas)
}
