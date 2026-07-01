import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'
import { isCronAuthorized } from '@/lib/cron'
import { ensureOcorrenciaAtual } from '@/lib/rotinas'
import { periodShortLabel, type Frequencia } from '@/lib/rotinaPeriodo'

/**
 * POST/GET /api/rotinas/gerar-ocorrencias
 *
 * Job diário (Vercel Cron). Duas responsabilidades:
 *  1) Materializa a ocorrência do ciclo atual de cada rotina ativa (garante que
 *     "a próxima acontece" mesmo que ninguém abra a tela).
 *  2) Marca como 'perdida' toda ocorrência aberta cujo prazo já venceu e notifica
 *     o responsável + o líder da área (torna a falta visível e cobrável).
 *
 * Autenticado via header x-cron-secret / Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  return run(req)
}
export async function POST(req: NextRequest) {
  return run(req)
}

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) return apiError('Não autorizado', 401)

  const agora = new Date()

  // ── 1) Materializa o ciclo atual das rotinas ativas ──────────────────────────
  const rotinas = await prisma.rotinaArea.findMany({
    where: { ativo: true },
    select: { id: true, frequencia: true, inicioEm: true, areaId: true, responsavelId: true, title: true },
  })

  let criadas = 0
  for (const r of rotinas) {
    if (r.inicioEm && r.inicioEm > agora) continue
    const oc = await ensureOcorrenciaAtual(r, agora)
    // createdAt ~ agora indica que acabou de nascer neste run
    if (Math.abs(oc.createdAt.getTime() - agora.getTime()) < 60_000) criadas++
  }

  // ── 2) Marca vencidas como perdidas + notifica ───────────────────────────────
  const vencidas = await prisma.rotinaOcorrencia.findMany({
    where: { estado: 'aberta', prazo: { lt: agora } },
    include: { rotina: { select: { id: true, title: true, frequencia: true, areaId: true, responsavelId: true } } },
  })

  // líderes de área (responsibleId) para escalar a falta
  const areaIds = Array.from(new Set(vencidas.map((v) => v.rotina.areaId)))
  const areas = areaIds.length
    ? await prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, responsibleId: true } })
    : []
  const liderByArea = new Map(areas.map((a) => [a.id, a.responsibleId]))

  let perdidas = 0, notificadas = 0
  for (const v of vencidas) {
    await prisma.rotinaOcorrencia.update({ where: { id: v.id }, data: { estado: 'perdida' } })
    perdidas++

    const cicloLabel = periodShortLabel(v.rotina.frequencia as Frequencia, v.periodo)

    // responsável
    await createNotification({
      userId: v.rotina.responsavelId,
      type: 'rotina_perdida',
      title: 'Rotina não entregue no prazo',
      body: `A rotina "${v.rotina.title}" (${cicloLabel}) venceu sem entrega.`,
      objectType: 'rotina',
      objectId: v.rotina.id,
    })
    notificadas++

    // líder da área (se diferente do responsável)
    const liderId = liderByArea.get(v.rotina.areaId)
    if (liderId && liderId !== v.rotina.responsavelId) {
      await createNotification({
        userId: liderId,
        type: 'rotina_perdida',
        title: 'Rotina da sua área não entregue',
        body: `"${v.rotina.title}" (${cicloLabel}) venceu sem entrega.`,
        objectType: 'rotina',
        objectId: v.rotina.id,
      })
      notificadas++
    }
  }

  console.log(`[CRON] rotinas/gerar-ocorrencias: ${criadas} criadas, ${perdidas} perdidas, ${notificadas} notificadas`)
  return apiSuccess({ criadas, perdidas, notificadas })
}
