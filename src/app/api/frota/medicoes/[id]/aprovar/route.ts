import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// POST /api/frota/medicoes/[id]/aprovar
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  // supervisor, manager, director, admin e master podem aprovar
  if (!['master', 'admin', 'director', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: {
      contrato: { select: { number: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (medicao.status !== 'enviada')
    return apiError('Apenas medições confirmadas pelo supervisor podem ser aprovadas', 400)
  if (!medicao.supervisorId)
    return apiError('A medição precisa ser conferida pelo supervisor antes da aprovação gerencial', 400)

  const updated = await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: {
      status: 'aprovada',
      aprovadorId: session.user.id,
      dataAprovacao: new Date(),
    },
  })

  // notifica quem criou a medição
  const mes = String(medicao.competenciaMes).padStart(2, '0')
  await createNotification({
    userId: medicao.createdBy.id,
    type: 'medicao_locacao_aprovada',
    title: 'Medição de locação aprovada',
    body: `${session.user.name} aprovou — Contrato ${medicao.contrato.number} ${mes}/${medicao.competenciaAno}`,
    objectType: 'medicao_locacao',
    objectId: params.id,
  })

  return apiSuccess(updated)
}
