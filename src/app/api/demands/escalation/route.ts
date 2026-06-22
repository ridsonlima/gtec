import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'
import { computeDemandSignals } from '@/lib/demandSignals'

/**
 * POST /api/demands/escalation
 *
 * Cron SEMANAL (segunda 08:00 BRT = 11:00 UTC). Cobrança automática:
 *  - Digest pessoal: cada responsável recebe um resumo das suas demandas
 *    estagnadas (7d+ sem evolução) e atrasadas.
 *  - Escalonamento: diretoria recebe um resumo global + piores responsáveis.
 *
 * Cadência semanal evita spam diário sem precisar de campo de "última cobrança".
 * Autenticado via header x-cron-secret.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return apiError('Não autorizado', 401)
  }

  const demands = await prisma.demand.findMany({
    where: { status: { notIn: ['completed', 'cancelled'] } },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      responsible: { select: { id: true, name: true } },
      updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })

  type Bucket = { name: string; stale: number; late: number; veryLate: number }
  const perUser = new Map<string, Bucket>()
  let totalStale = 0
  let totalLate = 0

  for (const d of demands) {
    if (!d.responsible) continue
    const s = computeDemandSignals({
      status: d.status,
      dueDate: d.dueDate,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      lastActivityAt: d.updates[0]?.createdAt ?? d.createdAt,
    })
    if (!s.isStale && s.overdueLevel === 'none') continue

    const uid = d.responsible.id
    const b = perUser.get(uid) ?? { name: d.responsible.name, stale: 0, late: 0, veryLate: 0 }
    if (s.isStale) { b.stale++; totalStale++ }
    if (s.overdueLevel === 'late') { b.late++; totalLate++ }
    if (s.overdueLevel === 'very_late') { b.veryLate++; totalLate++ }
    perUser.set(uid, b)
  }

  // 1) Digest pessoal para cada responsável com pendências
  let personalCount = 0
  for (const [uid, b] of Array.from(perUser.entries())) {
    const atrasadas = b.late + b.veryLate
    const partes: string[] = []
    if (b.stale) partes.push(`${b.stale} estagnada(s) (sem evolução há 7+ dias)`)
    if (atrasadas) partes.push(`${atrasadas} atrasada(s)${b.veryLate ? `, sendo ${b.veryLate} bastante atrasada(s)` : ''}`)
    if (!partes.length) continue
    await createNotification({
      userId: uid,
      type: 'weekly_digest',
      title: 'Resumo semanal — demandas que precisam de você',
      body: `${partes.join(' e ')}. Registre uma evolução ou ajuste o prazo.`,
      objectType: 'demand',
    })
    personalCount++
  }

  // 2) Escalonamento para a diretoria
  let directorCount = 0
  if (totalStale > 0 || totalLate > 0) {
    const worst = Array.from(perUser.values())
      .sort((a, b) => (b.veryLate + b.late + b.stale) - (a.veryLate + a.late + a.stale))
      .slice(0, 5)
      .map((b) => `${b.name} (${b.stale}E/${b.late + b.veryLate}A)`)
      .join('; ')

    const directors = await prisma.user.findMany({
      where: { role: { in: ['master', 'director', 'admin'] }, isActive: true },
      select: { id: true },
    })
    for (const dir of directors) {
      await createNotification({
        userId: dir.id,
        type: 'weekly_digest',
        title: 'Resumo semanal da equipe',
        body: `${totalStale} estagnada(s) e ${totalLate} atrasada(s) no total. Atenção: ${worst}.`,
        objectType: 'demand',
      })
      directorCount++
    }
  }

  console.log(`[CRON] demands/escalation: ${personalCount} digests pessoais, ${directorCount} diretores notificados`)
  return apiSuccess({ personalCount, directorCount, totalStale, totalLate })
}
