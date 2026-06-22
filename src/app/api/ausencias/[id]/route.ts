import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove } from '@/lib/permissions'

// ─── PATCH /api/ausencias/[id] ────────────────────────────────────────────────
// Atualiza datas/substituto OU encerra a ausência (ativo=false)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const aviso = await prisma.avisoAusencia.findUnique({ where: { id: params.id } })
  if (!aviso) return apiError('Aviso não encontrado', 404)

  const body = await req.json()
  const { substitutoId, dataFim, dataInicio, observacoes, ativo } = body

  const data: Record<string, unknown> = {}

  if (substitutoId !== undefined) {
    if (substitutoId === aviso.usuarioId) return apiError('O substituto não pode ser o mesmo usuário ausente', 400)
    const sub = await prisma.user.findUnique({ where: { id: substitutoId } })
    if (!sub) return apiError('Substituto não encontrado', 404)
    data.substitutoId = substitutoId
  }

  if (dataInicio !== undefined) data.dataInicio = new Date(dataInicio)
  if (dataFim !== undefined)    data.dataFim    = dataFim ? new Date(dataFim) : null
  if (observacoes !== undefined) data.observacoes = observacoes?.trim() || null

  // Encerrar ausência
  if (ativo === false) {
    data.ativo   = false
    data.dataFim = data.dataFim ?? new Date() // registra o encerramento agora
  }

  const updated = await prisma.avisoAusencia.update({
    where: { id: params.id },
    data,
    include: {
      usuario:   { select: { id: true, name: true } },
      substituto:{ select: { id: true, name: true } },
      criadoPor: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(updated)
}

// ─── DELETE /api/ausencias/[id] ───────────────────────────────────────────────
// Encerra imediatamente (equivale a PATCH ativo=false)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const aviso = await prisma.avisoAusencia.findUnique({ where: { id: params.id } })
  if (!aviso) return apiError('Aviso não encontrado', 404)

  await prisma.avisoAusencia.update({
    where: { id: params.id },
    data: { ativo: false, dataFim: new Date() },
  })

  return apiSuccess({ ok: true })
}
