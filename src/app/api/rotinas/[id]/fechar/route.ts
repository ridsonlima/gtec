import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { ensureOcorrenciaAtual } from '@/lib/rotinas'

const STATUS = ['concluida', 'parcial', 'pendencias', 'nao_realizada']

// POST /api/rotinas/[id]/fechar — fecha o ciclo atual com um status (entregue).
// Body: { status, resumo? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)
  const podeFechar = rotina.responsavelId === session.user.id || canManageRotina(session.user.role)
  if (!podeFechar) return apiError('Apenas o responsável fecha o ciclo', 403)

  let status = 'concluida'
  let resumo: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.status === 'string' && STATUS.includes(body.status)) status = body.status
    if (typeof body?.resumo === 'string') resumo = body.resumo.trim() || null
  } catch { /* fecha como concluída */ }

  const oc = await ensureOcorrenciaAtual(rotina)
  const updated = await prisma.rotinaOcorrencia.update({
    where: { id: oc.id },
    data: { estado: 'entregue', statusFechamento: status, resumo, fechadoEm: new Date(), fechadoPorId: session.user.id },
  })

  return apiSuccess(updated)
}

// DELETE /api/rotinas/[id]/fechar — reabre o ciclo atual (volta a 'aberta')
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)
  const podeReabrir = rotina.responsavelId === session.user.id || canManageRotina(session.user.role)
  if (!podeReabrir) return apiError('Sem permissão', 403)

  const oc = await ensureOcorrenciaAtual(rotina)
  const updated = await prisma.rotinaOcorrencia.update({
    where: { id: oc.id },
    data: { estado: 'aberta', statusFechamento: null, resumo: null, fechadoEm: null, fechadoPorId: null },
  })

  return apiSuccess(updated)
}
