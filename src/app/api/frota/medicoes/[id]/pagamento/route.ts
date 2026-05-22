import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// POST /api/frota/medicoes/[id]/pagamento  — registra guia gerada e/ou pagamento
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: { contrato: { select: { number: true } } },
  })
  if (!medicao) return apiError('Medição não encontrada', 404)

  const body = await req.json()
  const { acao } = body
  // acao: 'gerar_guia' | 'registrar_pagamento'

  if (acao === 'gerar_guia') {
    if (medicao.status !== 'aprovada')
      return apiError('Medição precisa estar aprovada para gerar guia', 400)

    const updated = await prisma.medicaoLocacao.update({
      where: { id: params.id },
      data: {
        status: 'guia_gerada',
        guiaPdfKey: body.guiaPdfKey || null,
      },
    })
    return apiSuccess(updated)
  }

  if (acao === 'registrar_pagamento') {
    if (medicao.status !== 'guia_gerada')
      return apiError('Gere a guia antes de registrar o pagamento', 400)
    if (!body.dataPagamento) return apiError('dataPagamento é obrigatório', 400)

    const updated = await prisma.medicaoLocacao.update({
      where: { id: params.id },
      data: {
        status: 'paga',
        dataPagamento: new Date(body.dataPagamento),
        comprovantePdfKey: body.comprovantePdfKey || null,
      },
    })

    // notifica diretores / admins do encerramento
    const gestores = await prisma.user.findMany({
      where: { role: { in: ['master', 'admin', 'director'] }, isActive: true },
      select: { id: true },
    })
    const mes = String(medicao.competenciaMes).padStart(2, '0')
    if (gestores.length) {
      await prisma.notification.createMany({
        data: gestores.map((g) => ({
          userId: g.id,
          type: 'medicao_locacao_paga',
          title: 'Medição de locação encerrada',
          body: `Contrato ${medicao.contrato.number} — ${mes}/${medicao.competenciaAno} foi paga`,
          objectType: 'medicao_locacao',
          objectId: params.id,
        })),
        skipDuplicates: true,
      })
    }

    return apiSuccess(updated)
  }

  return apiError('acao inválida. Use "gerar_guia" ou "registrar_pagamento"', 400)
}
