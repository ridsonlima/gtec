import { auth } from '@/lib/auth'
import { apiError } from '@/types/api'
import { getApprovoCredsForUser, getApprovoRawDocuments } from '@/lib/approvoService'

/**
 * GET /api/approvo/debug
 * Diagnóstico: retorna o PRIMEIRO documento cru do Approvo do usuário logado,
 * com todas as chaves disponíveis. Use para mapear os campos corretos.
 */
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const creds = await getApprovoCredsForUser(session.user.id)
  if (!creds) return apiError('Approvo não configurado para o seu usuário', 400)

  try {
    const docs = await getApprovoRawDocuments(creds)
    const primeiro = docs[0] ?? null
    return Response.json({
      ok: true,
      totalDocumentos: docs.length,
      chavesDisponiveis: primeiro ? Object.keys(primeiro).sort() : [],
      primeiroDocumento: primeiro,
    }, { status: 200 })
  } catch (e) {
    return Response.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, { status: 200 })
  }
}
