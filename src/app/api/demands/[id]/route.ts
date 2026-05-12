import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

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

  // Marca como vencidas
  const { count: overdueCount } = await prisma.demand.updateMany({
    where: {
      dueDate: { lt: today },
      status: { notIn: ['completed', 'cancelled'] },
      isOverdue: false,
    },
    data: { isOverdue: true },
  })

  // Desmarca vencidas que foram concluídas/canceladas
  const { count: resolvedCount } = await prisma.demand.updateMany({
    where: {
      status: { in: ['completed', 'cancelled'] },
      isOverdue: true,
    },
    data: { isOverdue: false },
  })

  console.log(
    `[CRON] demands/overdue: ${overdueCount} marcadas, ${resolvedCount} desmarcadas`
  )

  return apiSuccess({ overdueCount, resolvedCount })
}
