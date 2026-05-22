import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const area = await prisma.area.findUnique({
    where: { id: params.id },
    include: {
      userScopes: {
        where: { isPrimary: true },
        take: 1,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })
  if (!area) return apiError('Área não encontrada', 404)

  return apiSuccess(area)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) {
    return apiError('Sem permissão', 403)
  }

  const area = await prisma.area.findUnique({ where: { id: params.id } })
  if (!area) return apiError('Área não encontrada', 404)

  const body = await req.json()
  const { name, description, sortOrder } = body

  if (name !== undefined && (!name || name.trim().length < 2)) {
    return apiError('Nome inválido', 400)
  }

  const updated = await prisma.area.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
    },
  })

  return apiSuccess(updated)
}
