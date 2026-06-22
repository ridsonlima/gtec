import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, apiSuccess } from '@/types/api'
import { getApprovoCredsForUser, getApprovoDetalhe } from '@/lib/approvoService'

/**
 * POST /api/approvo/detalhe
 * Body: { chaveCompleta: string }
 * Retorna aprovadores + (para mapas de cotação) itens × fornecedores × preços.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const creds = await getApprovoCredsForUser(session.user.id)
  if (!creds) return apiError('Approvo não configurado para o seu usuário', 400)

  const body = await req.json().catch(() => ({}))
  const chaveCompleta = String(body.chaveCompleta ?? '')
  if (!chaveCompleta) return apiError('chaveCompleta é obrigatória', 400)

  try {
    const detalhe = await getApprovoDetalhe(creds, chaveCompleta, session.user.name ?? '')
    return apiSuccess(detalhe)
  } catch (e) {
    console.error('[POST /api/approvo/detalhe]', e instanceof Error ? e.message : e)
    return apiError('Não foi possível carregar o detalhe no Approvo.', 502)
  }
}
