import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { periodKey, type Frequencia } from '@/lib/rotinaPeriodo'

async function loadRotina(id: string) {
  return prisma.rotinaArea.findUnique({ where: { id } })
}

// POST /api/rotinas/[id]/concluir — registra a entrega do ciclo atual (texto opcional)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const rotina = await loadRotina(params.id)
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)
  const podeEntregar = rotina.responsavelId === session.user.id || canManageRotina(session.user.role)
  if (!podeEntregar) return apiError('Apenas o responsável pode entregar', 403)

  const STATUS = ['concluida', 'parcial', 'pendencias', 'nao_realizada']
  let texto: string | null = null
  let status = 'concluida'
  try {
    const body = await req.json()
    if (typeof body?.texto === 'string') texto = body.texto.trim() || null
    if (typeof body?.status === 'string' && STATUS.includes(body.status)) status = body.status
  } catch { /* sem corpo = marca como concluída */ }

  const periodo = periodKey(rotina.frequencia as Frequencia)
  const c = await prisma.rotinaConclusao.upsert({
    where: { rotinaId_periodo: { rotinaId: rotina.id, periodo } },
    create: { rotinaId: rotina.id, periodo, status, texto, concluidoPorId: session.user.id },
    update: { status, texto, concluidoEm: new Date(), concluidoPorId: session.user.id },
  })
  return apiSuccess(c)
}

// DELETE /api/rotinas/[id]/concluir — desfaz a entrega do ciclo atual
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const rotina = await loadRotina(params.id)
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)
  const podeEntregar = rotina.responsavelId === session.user.id || canManageRotina(session.user.role)
  if (!podeEntregar) return apiError('Sem permissão', 403)

  const periodo = periodKey(rotina.frequencia as Frequencia)
  const c = await prisma.rotinaConclusao.findUnique({ where: { rotinaId_periodo: { rotinaId: rotina.id, periodo } } })
  if (c) {
    await prisma.attachment.deleteMany({ where: { objectType: 'rotina_entrega', objectId: c.id } })
    await prisma.rotinaConclusao.delete({ where: { id: c.id } })
  }
  return apiSuccess({ ok: true })
}
