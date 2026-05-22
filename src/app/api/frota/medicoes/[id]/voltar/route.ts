import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

const ETAPA_ANTERIOR: Record<string, string> = {
  aguard_supervisor: 'rascunho',
  enviada:           'aguard_supervisor',
  aprovada:          'enviada',
  guia_gerada:       'aprovada',
}

/**
 * POST /api/frota/medicoes/[id]/voltar
 * Apenas master e admin. Retorna a medição para a etapa anterior.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin'].includes(session.user.role))
    return apiError('Apenas master ou admin podem retornar etapas', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)

  const anterior = ETAPA_ANTERIOR[medicao.status]
  if (!anterior)
    return apiError('Esta medição não pode retornar para uma etapa anterior', 400)

  const data: any = { status: anterior }

  // Limpa campos da etapa que está sendo desfeita
  if (medicao.status === 'aguard_supervisor') {
    // Voltou para rascunho: limpa dados do supervisor
    data.supervisorId = null
    data.supervisorAprovadoEm = null
    data.supervisorNota = null
  }
  if (medicao.status === 'aprovada') {
    // Voltou para enviada: limpa aprovação gerencial
    data.aprovadorId = null
    data.dataAprovacao = null
  }
  if (medicao.status === 'guia_gerada') {
    data.guiaPdfKey = null
  }

  const updated = await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data,
  })

  return apiSuccess(updated)
}
