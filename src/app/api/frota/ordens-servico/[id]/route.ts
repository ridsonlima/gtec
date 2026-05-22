import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

const INCLUDE_FULL = {
  ativo: {
    select: {
      id: true, tag: true, descricao: true, categoria: true,
      tipo: true, status: true, placa: true, marca: true, modelo: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
}

// GET /api/frota/ordens-servico/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const os = await prisma.ordemServico.findUnique({
    where: { id: params.id },
    include: INCLUDE_FULL,
  })
  if (!os) return apiError('Ordem de serviço não encontrada', 404)

  return apiSuccess(os)
}

// PATCH /api/frota/ordens-servico/[id]  — edita campos da OS aberta
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const os = await prisma.ordemServico.findUnique({ where: { id: params.id } })
  if (!os) return apiError('Ordem de serviço não encontrada', 404)
  if (['concluida', 'cancelada'].includes(os.status))
    return apiError('OS encerrada não pode ser editada', 400)

  const body = await req.json()

  const updated = await prisma.ordemServico.update({
    where: { id: params.id },
    data: {
      ...(body.descricao !== undefined && { descricao: body.descricao }),
      ...(body.dataPrevista !== undefined && { dataPrevista: body.dataPrevista ? new Date(body.dataPrevista) : null }),
      ...(body.executante !== undefined && { executante: body.executante }),
      ...(body.custo !== undefined && { custo: body.custo != null ? Number(body.custo) : null }),
      ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
    },
    include: INCLUDE_FULL,
  })

  return apiSuccess(updated)
}
