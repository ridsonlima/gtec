import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove } from '@/lib/permissions'

// GET /api/comunicados/[id] — detalhe + quem já deu ciência (para o autor/gestor)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const comunicado = await prisma.comunicado.findUnique({
    where: { id: params.id },
    include: {
      author:   { select: { id: true, name: true } },
      alvoArea: { select: { id: true, name: true } },
      leituras: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { aceiteEm: 'desc' },
      },
    },
  })
  if (!comunicado) return apiError('Comunicado não encontrado', 404)

  return apiSuccess(comunicado)
}

// DELETE /api/comunicados/[id] — encerra (autor ou admin)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const comunicado = await prisma.comunicado.findUnique({ where: { id: params.id } })
  if (!comunicado) return apiError('Comunicado não encontrado', 404)

  const isAuthor = comunicado.authorId === session.user.id
  const isAdmin = ['master', 'admin'].includes(session.user.role)
  if (!isAuthor && !isAdmin) return apiError('Sem permissão', 403)

  await prisma.comunicado.update({ where: { id: params.id }, data: { ativo: false } })
  return apiSuccess({ encerrado: true })
}
