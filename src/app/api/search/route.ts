import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { getUserAreaIds, isDirector } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return apiSuccess({ demands: [], reports: [], projects: [], contracts: [] })

  const areaIds = getUserAreaIds(session)
  const dir     = isDirector(session.user.role)

  const areaFilter = areaIds && !dir ? { areaId: { in: areaIds } } : {}

  const [demands, reports, projects, contracts] = await Promise.all([
    prisma.demand.findMany({
      where: { ...areaFilter, title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true, status: true, priority: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.report.findMany({
      where: {
        ...(areaIds && !dir ? { areaId: { in: areaIds } } : {}),
        title: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, title: true, status: true, area: { select: { name: true } } },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        ...(!dir ? { responsibleId: session.user.id } : {}),
      },
      select: { id: true, name: true, status: true, riskLevel: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contract.findMany({
      where: {
        ...(areaIds && !dir ? { areaId: { in: areaIds } } : {}),
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { number: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, number: true, status: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return apiSuccess({ demands, reports, projects, contracts })
}
