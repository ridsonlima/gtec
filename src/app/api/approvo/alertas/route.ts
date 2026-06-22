import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove } from '@/lib/permissions'
import { getApprovoAlerts, getApprovoSummary, getApprovoCredsForUser } from '@/lib/approvoService'

/**
 * GET /api/approvo/alertas
 * Proxy backend para o Approvo — evita CORS no navegador.
 * O servidor chama o endpoint real do Approvo (com fallback para mock) e
 * devolve o JSON já tratado para o frontend.
 *
 * ?resumo=true → retorna apenas o resumo agregado (cards)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const apenasResumo = req.nextUrl.searchParams.get('resumo') === 'true'
  const creds = await getApprovoCredsForUser(session.user.id)

  try {
    if (apenasResumo) {
      const resumo = await getApprovoSummary(creds)
      return apiSuccess(resumo)
    }
    const alertas = await getApprovoAlerts(creds)
    return apiSuccess(alertas)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Erro ao consultar o Approvo', 502)
  }
}
