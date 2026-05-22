import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/auditorias/[id]/iniciar  — muda status para em_andamento
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const visita = await prisma.auditoriaVisita.findUnique({ where: { id: params.id } })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (visita.status !== 'agendada')
    return apiError('Apenas visitas agendadas podem ser iniciadas', 400)

  // só o auditor designado ou admin/master pode iniciar
  const podeIniciar =
    ['master', 'admin'].includes(session.user.role) || visita.auditorId === session.user.id
  if (!podeIniciar) return apiError('Sem permissão para iniciar esta visita', 403)

  const updated = await prisma.auditoriaVisita.update({
    where: { id: params.id },
    data: { status: 'em_andamento' },
  })

  return apiSuccess(updated)
}
