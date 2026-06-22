import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector } from '@/lib/permissions'

// GET /api/comunicados/pendentes — nº de comunicados que aguardam o "ciente" do usuário
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const minhasAreaIds = session.user.areaScopes.map((s) => s.areaId)
  const verTudo = isDirector(session.user.role)

  const where: any = {
    ativo: true,
    exigeAceite: true,
    // ainda não deu ciente
    leituras: { none: { userId: session.user.id, aceiteEm: { not: null } } },
  }
  if (!verTudo) {
    where.OR = [
      { alvoTipo: 'todos' },
      { alvoTipo: 'area', alvoAreaId: { in: minhasAreaIds } },
    ]
  }

  const count = await prisma.comunicado.count({ where })
  return apiSuccess({ count })
}
