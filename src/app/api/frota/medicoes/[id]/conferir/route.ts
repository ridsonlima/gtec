import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

/**
 * POST /api/frota/medicoes/[id]/conferir
 * Body: { acao: 'confirmar' | 'devolver', nota: string }
 *
 * Supervisor de obra obrigatoriamente preenche uma nota ao conferir.
 * - confirmar: avança para 'enviada' (aprovação gerencial)
 * - devolver:  volta para 'rascunho' para correção do gestor
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  // Supervisor, manager, director, admin e master podem conferir
  if (!['master', 'admin', 'director', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão para conferir medições', 403)

  const body = await req.json()
  const { acao, nota } = body as { acao: 'confirmar' | 'devolver'; nota: string }

  if (!['confirmar', 'devolver'].includes(acao))
    return apiError('Ação inválida. Use "confirmar" ou "devolver"', 400)
  if (!nota || !nota.trim())
    return apiError('A nota de conferência é obrigatória. Descreva o que foi verificado.', 400)

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: {
      contrato: { select: { number: true, name: true, responsibleId: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (medicao.status !== 'aguard_supervisor')
    return apiError('Esta medição não está aguardando conferência do supervisor', 400)

  const mes = String(medicao.competenciaMes).padStart(2, '0')

  if (acao === 'confirmar') {
    const updated = await prisma.medicaoLocacao.update({
      where: { id: params.id },
      data: {
        status: 'enviada',
        supervisorId: session.user.id,
        supervisorAprovadoEm: new Date(),
        supervisorNota: nota.trim(),
        rejeicaoMotivo: null,
      },
    })

    // Notifica o criador que o supervisor confirmou
    await createNotification({
      userId: medicao.createdBy.id,
      type: 'medicao_locacao_supervisor_confirmou',
      title: 'Supervisor confirmou a medição',
      body: `${session.user.name} conferiu e confirmou — Contrato ${medicao.contrato.number} ${mes}/${medicao.competenciaAno}. Aguarda aprovação gerencial.`,
      objectType: 'medicao_locacao',
      objectId: params.id,
    })

    return apiSuccess(updated)
  } else {
    // devolver para rascunho
    const updated = await prisma.medicaoLocacao.update({
      where: { id: params.id },
      data: {
        status: 'rascunho',
        supervisorId: session.user.id,
        supervisorAprovadoEm: null,
        supervisorNota: nota.trim(),
        rejeicaoMotivo: `Devolvida pelo supervisor ${session.user.name}: ${nota.trim()}`,
      },
    })

    // Notifica o criador que o supervisor devolveu
    await createNotification({
      userId: medicao.createdBy.id,
      type: 'medicao_locacao_supervisor_devolveu',
      title: 'Medição devolvida para correção',
      body: `${session.user.name}: "${nota.trim()}" — Contrato ${medicao.contrato.number} ${mes}/${medicao.competenciaAno}`,
      objectType: 'medicao_locacao',
      objectId: params.id,
    })

    return apiSuccess(updated)
  }
}
