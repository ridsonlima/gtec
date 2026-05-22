import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { getUserAreaIds } from '@/lib/permissions'

// POST — marca todas as evoluções visíveis ao usuário como vistas
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const areaIds = getUserAreaIds(session)

  // Busca todos os updateIds ainda não vistos pelo usuário
  const updates = await prisma.demandUpdate.findMany({
    where: {
      content: { not: '' },
      demand: areaIds ? { areaId: { in: areaIds } } : undefined,
      views: { none: { userId: session.user.id } },
    },
    select: { id: true },
    take: 500,
  })

  if (updates.length === 0) return apiSuccess({ marked: 0 })

  await prisma.demandUpdateView.createMany({
    data: updates.map((u) => ({ updateId: u.id, userId: session.user.id })),
    skipDuplicates: true,
  })

  return apiSuccess({ marked: updates.length })
}
