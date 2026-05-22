import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/auditorias/[id]/cancelar
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const visita = await prisma.auditoriaVisita.findUnique({ where: { id: params.id } })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (!['agendada', 'em_andamento'].includes(visita.status))
    return apiError('Só é possível cancelar visitas agendadas ou em andamento', 400)

  const updated = await prisma.auditoriaVisita.update({
    where: { id: params.id },
    data: { status: 'cancelada' },
  })

  return apiSuccess(updated)
}
