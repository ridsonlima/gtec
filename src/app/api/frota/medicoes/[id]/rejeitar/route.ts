import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// POST /api/frota/medicoes/[id]/rejeitar
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: {
      contrato: { select: { number: true } },
      createdBy: { select: { id: true } },
    },
  })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (medicao.status !== 'enviada')
    return apiError('Apenas medições enviadas podem ser rejeitadas', 400)

  const body = await req.json()
  if (!body.motivo?.trim()) return apiError('Informe o motivo da rejeição', 400)

  const updated = await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: {
      status: 'rascunho',
      rejeicaoMotivo: body.motivo.trim(),
      aprovadorId: null,
      dataAprovacao: null,
    },
  })

  const mes = String(medicao.competenciaMes).padStart(2, '0')
  await createNotification({
    userId: medicao.createdBy.id,
    type: 'medicao_locacao_rejeitada',
    title: 'Medição de locação rejeitada',
    body: `${session.user.name} rejeitou — Contrato ${medicao.contrato.number} ${mes}/${medicao.competenciaAno}: ${body.motivo}`,
    objectType: 'medicao_locacao',
    objectId: params.id,
  })

  return apiSuccess(updated)
}
