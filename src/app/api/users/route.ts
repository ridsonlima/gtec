import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const areaId = searchParams.get('areaId')

  // Build user list — if areaId given, filter to users with scope on that area
  // plus all directors/admins (who have global access)
  const users = await prisma.user.findMany({
    where: areaId
      ? {
          isActive: true,
          OR: [
            { role: { in: ['master', 'admin', 'director'] } },
            { areaScopes: { some: { areaId } } },
          ],
        }
      : { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return apiSuccess(users)
}


export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissao', 403)

  const body = await req.json()
  if (!body.name || !body.email || !body.password || !body.role) {
    return apiError('Nome, e-mail, senha e perfil sao obrigatorios', 400)
  }

  const exists = await prisma.user.findUnique({ where: { email: body.email } })
  if (exists) return apiError('Ja existe usuario com este e-mail', 409)

  const passwordHash = await bcrypt.hash(String(body.password), 12)
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role,
      isActive: true,
      areaScopes: body.areaIds?.length
        ? {
            create: body.areaIds.map((areaId: string, index: number) => ({
              areaId,
              canWrite: Boolean(body.canWrite),
              isPrimary: index === 0,
            })),
          }
        : undefined,
    },
    select: { id: true, name: true, email: true, role: true },
  })

  return apiSuccess(user, 201)
}
