import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/users/search?q=João — autocomplete de menções e colaboradores
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return apiSuccess([])

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      name: { contains: q, mode: 'insensitive' },
    },
    select: { id: true, name: true, role: true },
    take: 10,
    orderBy: { name: 'asc' },
  })

  return apiSuccess(users)
}
