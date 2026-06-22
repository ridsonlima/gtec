import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { periodKey, type Frequencia } from '@/lib/rotinaPeriodo'

async function loadRotina(id: string) {
  return prisma.rotinaArea.findUnique({ where: { id } })
}

// POST /api/rotinas/[id]/concluir — marca a rotina como feita no ciclo atual
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const rotina = await loadRotina(params.id)
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)

  const periodo = periodKey(rotina.frequencia as Frequencia)
  const c = await prisma.rotinaConclusao.upsert({
    where: { rotinaId_periodo: { rotinaId: rotina.id, periodo } },
    create: { rotinaId: rotina.id, periodo, concluidoPorId: session.user.id },
    update: { concluidoEm: new Date(), concluidoPorId: session.user.id },
  })
  return apiSuccess(c)
}

// DELETE /api/rotinas/[id]/concluir — desfaz a conclusão do ciclo atual
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const rotina = await loadRotina(params.id)
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)

  const periodo = periodKey(rotina.frequencia as Frequencia)
  await prisma.rotinaConclusao.deleteMany({ where: { rotinaId: rotina.id, periodo } })
  return apiSuccess({ ok: true })
}
