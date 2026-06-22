import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { notifySlaBreach } from '@/lib/notifications'
import { isCronAuthorized } from '@/lib/cron'

/**
 * POST /api/demands/sla-check
 * Cron Vercel — roda a cada hora.
 * 1. Marca slaStatus='warning' para demandas cuja deadline vence em < 1h
 * 2. Marca slaStatus='breached' e escalada para diretoria em deadline ultrapassada
 */
export async function GET(req: NextRequest) {
  return runSlaCheck(req)
}

export async function POST(req: NextRequest) {
  return runSlaCheck(req)
}

async function runSlaCheck(req: NextRequest) {
  if (!isCronAuthorized(req)) return apiError('Não autorizado', 401)

  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 3600_000)

  // Marca warning: deadline entre agora e +1h (ainda não breach)
  const { count: warnCount } = await prisma.demand.updateMany({
    where: {
      acceptanceStatus: 'pending_acceptance',
      slaDeadline: { gt: now, lte: oneHourFromNow },
      slaStatus: 'ok',
    },
    data: { slaStatus: 'warning' },
  })

  // Marca breach: deadline já passou
  const breached = await prisma.demand.findMany({
    where: {
      acceptanceStatus: 'pending_acceptance',
      slaDeadline: { lt: now },
      slaStatus: { not: 'breached' },
    },
    select: { id: true, title: true, areaId: true },
  })

  if (breached.length > 0) {
    await prisma.demand.updateMany({
      where: { id: { in: breached.map((d) => d.id) } },
      data: { slaStatus: 'breached' },
    })

    await Promise.all(
      breached.map((d) => notifySlaBreach(d.id, d.title, d.areaId))
    )
  }

  console.log(`[CRON] sla-check: ${warnCount} warnings, ${breached.length} breaches`)
  return apiSuccess({ warnings: warnCount, breaches: breached.length })
}
