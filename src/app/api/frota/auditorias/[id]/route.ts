import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

const INCLUDE_FULL = {
  projeto: { select: { id: true, name: true } },
  contrato: { select: { id: true, number: true, name: true } },
  auditor: { select: { id: true, name: true } },
  itens: {
    include: {
      ativo: { select: { id: true, tag: true, descricao: true, categoria: true, tipo: true } },
      pendencia: {
        select: {
          id: true,
          severidade: true,
          status: true,
          prazo: true,
          responsavel: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { ativo: { tag: 'asc' } } as any,
  },
  pendencias: {
    include: {
      item: {
        include: {
          ativo: { select: { id: true, tag: true, descricao: true } },
        },
      },
      responsavel: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' } as any,
  },
}

// GET /api/frota/auditorias/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const visita = await prisma.auditoriaVisita.findUnique({
    where: { id: params.id },
    include: INCLUDE_FULL,
  })
  if (!visita) return apiError('Visita não encontrada', 404)

  return apiSuccess(visita)
}

// PATCH /api/frota/auditorias/[id]  — edita dados da visita agendada
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const visita = await prisma.auditoriaVisita.findUnique({ where: { id: params.id } })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (visita.status === 'concluida')
    return apiError('Visita concluída não pode ser editada', 400)

  const body = await req.json()

  const updated = await prisma.auditoriaVisita.update({
    where: { id: params.id },
    data: {
      ...(body.dataVisita && { dataVisita: new Date(body.dataVisita) }),
      ...(body.auditorId && { auditorId: body.auditorId }),
      ...(body.projetoId !== undefined && { projetoId: body.projetoId }),
      ...(body.contratoId !== undefined && { contratoId: body.contratoId }),
      ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
      ...(body.status && { status: body.status }),
    },
    include: INCLUDE_FULL,
  })

  return apiSuccess(updated)
}

// DELETE /api/frota/auditorias/[id]  — cancela visita agendada
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const visita = await prisma.auditoriaVisita.findUnique({
    where: { id: params.id },
    include: { _count: { select: { itens: true } } },
  })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (visita.status === 'concluida')
    return apiError('Visita concluída não pode ser excluída', 400)
  if (visita._count.itens > 0)
    return apiError('Visita com itens registrados não pode ser excluída — cancele-a', 400)

  await prisma.auditoriaVisita.delete({ where: { id: params.id } })
  return apiSuccess({ deleted: true })
}
