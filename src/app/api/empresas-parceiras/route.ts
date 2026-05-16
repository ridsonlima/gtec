import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')

  const empresas = await prisma.empresaParceira.findMany({
    where: {
      isActive: true,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
  })

  return apiSuccess(empresas)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  if (!body.name) return apiError('Nome obrigatório', 400)

  const empresa = await prisma.empresaParceira.create({
    data: {
      name: body.name,
      cnpj: body.cnpj || null,
      contactName: body.contactName || null,
      contactPhone: body.contactPhone || null,
    },
  })

  return apiSuccess(empresa, 201)
}
