import type { NextRequest } from 'next/server'

/**
 * Autoriza requisições de cron. Aceita os dois padrões:
 *  - Vercel Cron: envia `Authorization: Bearer <CRON_SECRET>` (quando a env existe).
 *  - Manual/externo: header `x-cron-secret: <CRON_SECRET>`.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true
  if (req.headers.get('x-cron-secret') === secret) return true
  return false
}
