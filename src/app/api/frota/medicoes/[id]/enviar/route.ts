import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// POST /api/frota/medicoes/[id]/enviar
// Gestor envia para conferência obrigatória do supervisor de obra
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: {
      contrato: { select: { id: true, number: true, name: true, responsibleId: true } },
      _count: { select: { itens: true } },
    },
  })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (!['rascunho', 'rejeitada'].includes(medicao.status))
    return apiError('Apenas medições em rascunho ou rejeitadas podem ser enviadas', 400)
  if (medicao._count.itens === 0)
    return apiError('Adicione ao menos um item antes de enviar', 400)

  const updated = await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: {
      status: 'aguard_supervisor',
      rejeicaoMotivo: null,
      supervisorId: null,
      supervisorAprovadoEm: null,
      supervisorNota: null,
    },
  })

  // Notifica o responsável pelo contrato (que deve ser supervisor de obra)
  if (medicao.contrato.responsibleId) {
    const mes = String(medicao.competenciaMes).padStart(2, '0')
    await createNotification({
      userId: medicao.contrato.responsibleId,
      type: 'medicao_locacao_enviada',
      title: 'Medição aguarda sua conferência',
      body: `Contrato ${medicao.contrato.number} — ${mes}/${medicao.competenciaAno}. Acesse para confirmar os dias e valores.`,
      objectType: 'medicao_locacao',
      objectId: params.id,
    })
  }

  return apiSuccess(updated)
}
