import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { NextRequest } from 'next/server'

type Params = { params: { id: string } }

// GET /api/agenda/[id]  — detalhe de uma pauta específica
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) {
    return apiError('Acesso restrito', 403)
  }

  const agenda = await prisma.meetingAgenda.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          report: { select: { id: true, title: true } },
          demand: { select: { id: true, title: true } },
        },
      },
    },
  })

  if (!agenda) return apiError('Pauta não encontrada', 404)

  return apiSuccess(agenda)
}
