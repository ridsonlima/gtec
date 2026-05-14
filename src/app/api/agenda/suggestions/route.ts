import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

/**
 * GET /api/agenda/suggestions
 * Retorna reports publicados com agendaSuggestion preenchida
 * que ainda NÃO foram adicionados a nenhuma pauta como item.
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director', 'manager'].includes(session.user.role)) {
    return apiError('Acesso restrito', 403)
  }

  // Reports publicados com sugestão de pauta que não têm AgendaItem vinculado
  const reports = await prisma.report.findMany({
    where: {
      status: 'published',
      agendaSuggestion: { not: null },
      agendaItems: { none: {} }, // não vinculado a nenhum item de pauta
    },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      agendaSuggestion: true,
      publishedAt: true,
      area: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(reports)
}
