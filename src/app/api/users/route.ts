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
      areaScopes: {
        select: {
          areaId: true,
          canWrite: true,
          isPrimary: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return apiSuccess(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  if (!body.name || !body.email || !body.password || !body.role) {
    return apiError('Nome, e-mail, senha e perfil são obrigatórios', 400)
  }

  const exists = await prisma.user.findUnique({ where: { email: String(body.email).toLowerCase().trim() } })
  if (exists) return apiError('Já existe usuário com este e-mail', 409)

  const passwordHash = await bcrypt.hash(String(body.password), 12)
  const user = await prisma.user.create({
    data: {
      name: String(body.name).trim(),
      email: String(body.email).toLowerCase().trim(),
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
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      areaScopes: { select: { areaId: true, canWrite: true, isPrimary: true } },
    },
  })

  return apiSuccess(user, 201)
}
