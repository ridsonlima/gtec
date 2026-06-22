import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'

const FREQS = ['diaria', 'semanal', 'mensal']

// PATCH /api/rotinas/[id] — edita rotina
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageRotina(session.user.role)) return apiError('Sem permissão', 403)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  const data: any = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.descricao === 'string') data.descricao = body.descricao.trim() || null
  if (body.frequencia && FREQS.includes(body.frequencia)) data.frequencia = body.frequencia

  const updated = await prisma.rotinaArea.update({ where: { id: params.id }, data })
  return apiSuccess(updated)
}

// DELETE /api/rotinas/[id] — desativa rotina
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageRotina(session.user.role)) return apiError('Sem permissão', 403)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)

  await prisma.rotinaArea.update({ where: { id: params.id }, data: { ativo: false } })
  return apiSuccess({ ok: true })
}
