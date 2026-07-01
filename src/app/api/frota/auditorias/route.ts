import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

const INCLUDE_LISTA = {
  projeto: { select: { id: true, name: true } },
  contrato: { select: { id: true, number: true, name: true } },
  auditor: { select: { id: true, name: true } },
  _count: {
    select: {
      itens: true,
      pendencias: { where: { status: { in: ['aberta', 'em_tratativa'] } } },
    },
  },
}

// GET /api/frota/auditorias
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const auditorId = searchParams.get('auditorId')
  const projetoId = searchParams.get('projetoId')
  const contratoId = searchParams.get('contratoId')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  const where: any = {}
  if (status) where.status = status
  if (auditorId) where.auditorId = auditorId
  if (projetoId) where.projetoId = projetoId
  if (contratoId) where.contratoId = contratoId
  if (dataInicio || dataFim) {
    where.dataVisita = {}
    if (dataInicio) where.dataVisita.gte = new Date(dataInicio)
    if (dataFim) where.dataVisita.lte = new Date(dataFim)
  }

  const visitas = await prisma.auditoriaVisita.findMany({
    where,
    orderBy: { dataVisita: 'desc' },
    include: INCLUDE_LISTA,
  })

  return apiSuccess(visitas)
}

// POST /api/frota/auditorias  — agendar visita
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const body = await req.json()
  if (!body.dataVisita) return apiError('dataVisita é obrigatório', 400)

  const auditorId = body.auditorId || session.user.id
  const moduloTipo = body.moduloTipo || 'veiculo'

  const visita = await prisma.auditoriaVisita.create({
    data: {
      projetoId: body.projetoId || null,
      contratoId: body.contratoId || null,
      auditorId,
      dataVisita: new Date(body.dataVisita),
      status: 'agendada',
      moduloTipo,
      observacoes: body.observacoes || null,
    },
    include: INCLUDE_LISTA,
  })

  // notifica o auditor se for diferente de quem agendou
  if (auditorId !== session.user.id) {
    await createNotification({
      userId: auditorId,
      type: 'auditoria_agendada',
      title: 'Auditoria de campo agendada para você',
      body: `Data: ${new Date(body.dataVisita).toLocaleDateString('pt-BR')}${body.projetoId ? '' : ''}`,
      objectType: 'auditoria_visita',
      objectId: visita.id,
    })
  }

  return apiSuccess(visita, 201)
}
