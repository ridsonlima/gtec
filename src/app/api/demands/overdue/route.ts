import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

/**
 * POST /api/demands/overdue
 *
 * Job agendado (Vercel Cron ou externo) que marca demandas vencidas.
 * Autenticado via header x-cron-secret.
 *
 * Vercel cron.json:
 * {
 *   "crons": [{
 *     "path": "/api/demands/overdue",
 *     "schedule": "0 1 * * *"  <- 01:00 UTC diariamente
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return apiError('Não autorizado', 401)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Busca as demandas que VÃO ser marcadas como vencidas agora (para notificar)
  const recemVencidas = await prisma.demand.findMany({
    where: {
      dueDate: { lt: today },
      status: { notIn: ['completed', 'cancelled'] },
      isOverdue: false,
    },
    select: { id: true, title: true, responsibleId: true },
  })

  // Marca como vencidas
  const { count: overdueCount } = await prisma.demand.updateMany({
    where: {
      dueDate: { lt: today },
      status: { notIn: ['completed', 'cancelled'] },
      isOverdue: false,
    },
    data: { isOverdue: true },
  })

  // Notifica o responsável de cada demanda recém-vencida
  let notifiedCount = 0
  for (const d of recemVencidas) {
    if (!d.responsibleId) continue
    await createNotification({
      userId: d.responsibleId,
      type: 'demand_overdue',
      title: 'Demanda vencida',
      body: `A demanda "${d.title}" passou do prazo e precisa de atenção.`,
      objectType: 'demand',
      objectId: d.id,
    })
    notifiedCount++
  }

  // Desmarca vencidas que foram concluídas/canceladas
  const { count: resolvedCount } = await prisma.demand.updateMany({
    where: {
      status: { in: ['completed', 'cancelled'] },
      isOverdue: true,
    },
    data: { isOverdue: false },
  })

  console.log(
    `[CRON] demands/overdue: ${overdueCount} marcadas, ${resolvedCount} desmarcadas, ${notifiedCount} notificadas`
  )

  return apiSuccess({ overdueCount, resolvedCount, notifiedCount })
}
