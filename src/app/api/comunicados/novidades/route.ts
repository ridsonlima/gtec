import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector } from '@/lib/permissions'

// GET /api/comunicados/novidades — novidades do sistema que o usuário ainda NÃO leu.
// Alimenta o modal "O que há de novo" exibido ao logar.
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const minhasAreaIds = session.user.areaScopes.map((s) => s.areaId)
  const verTudo = isDirector(session.user.role)

  const where: any = {
    ativo: true,
    categoria: 'novidade',
    leituras: { none: { userId: session.user.id, lidoEm: { not: null } } },
  }
  if (!verTudo) {
    where.OR = [
      { alvoTipo: 'todos' },
      { alvoTipo: 'area', alvoAreaId: { in: minhasAreaIds } },
    ]
  }

  const novidades = await prisma.comunicado.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  })

  return apiSuccess(novidades)
}
