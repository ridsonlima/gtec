import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const empresa = await prisma.empresaParceira.update({
    where: { id: params.id },
    data: {
      name: body.name || undefined,
      cnpj: body.cnpj !== undefined ? (body.cnpj || null) : undefined,
      contactName: body.contactName !== undefined ? (body.contactName || null) : undefined,
      contactPhone: body.contactPhone !== undefined ? (body.contactPhone || null) : undefined,
    },
  })

  return apiSuccess(empresa)
}
