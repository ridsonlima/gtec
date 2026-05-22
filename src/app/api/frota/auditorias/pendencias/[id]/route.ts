import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// PATCH /api/frota/auditorias/pendencias/[id]  — atualiza pendência (atribuir, tratar, resolver)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const pendencia = await prisma.pendenciaAuditoria.findUnique({
    where: { id: params.id },
    include: {
      visita: {
        select: {
          auditorId: true,
          projeto: { select: { responsibleId: true } },
          contrato: { select: { responsibleId: true } },
        },
      },
    },
  })
  if (!pendencia) return apiError('Pendência não encontrada', 404)
  if (pendencia.status === 'resolvida')
    return apiError('Pendência já resolvida', 400)

  const body = await req.json()
  const { status, responsavelId, resolucaoNota, prazo } = body

  const statusValidos = ['aberta', 'em_tratativa', 'resolvida', 'reincidente']
  if (status && !statusValidos.includes(status))
    return apiError('Status inválido', 400)

  const data: any = {}
  if (status) data.status = status
  if (responsavelId !== undefined) data.responsavelId = responsavelId || null
  if (resolucaoNota !== undefined) data.resolucaoNota = resolucaoNota
  if (prazo !== undefined) data.prazo = prazo ? new Date(prazo) : null

  if (status === 'resolvida') {
    if (!resolucaoNota?.trim())
      return apiError('Informe a nota de resolução ao marcar como resolvida', 400)
    data.resolvidaEm = new Date()
  }

  const updated = await prisma.pendenciaAuditoria.update({
    where: { id: params.id },
    data,
    include: {
      item: {
        include: { ativo: { select: { id: true, tag: true, descricao: true } } },
      },
      responsavel: { select: { id: true, name: true } },
    },
  })

  // notifica o responsável quando atribuído
  if (responsavelId && responsavelId !== pendencia.responsavelId) {
    await createNotification({
      userId: responsavelId,
      type: 'pendencia_auditoria_atribuida',
      title: `Pendência de auditoria atribuída a você`,
      body: `${pendencia.severidade.toUpperCase()}: ${pendencia.descricao}`,
      objectType: 'pendencia_auditoria',
      objectId: params.id,
    })
  }

  // notifica o auditor quando resolvida
  if (status === 'resolvida') {
    await createNotification({
      userId: pendencia.visita.auditorId,
      type: 'pendencia_auditoria_resolvida',
      title: 'Pendência de auditoria resolvida',
      body: `${session.user.name} marcou como resolvida: ${pendencia.descricao}`,
      objectType: 'pendencia_auditoria',
      objectId: params.id,
    })
  }

  return apiSuccess(updated)
}

// GET /api/frota/auditorias/pendencias/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const pendencia = await prisma.pendenciaAuditoria.findUnique({
    where: { id: params.id },
    include: {
      visita: {
        select: {
          id: true,
          dataVisita: true,
          auditor: { select: { id: true, name: true } },
          projeto: { select: { id: true, name: true } },
          contrato: { select: { id: true, number: true, name: true } },
        },
      },
      item: {
        include: {
          ativo: { select: { id: true, tag: true, descricao: true, categoria: true } },
        },
      },
      responsavel: { select: { id: true, name: true } },
    },
  })
  if (!pendencia) return apiError('Pendência não encontrada', 404)

  return apiSuccess(pendencia)
}
