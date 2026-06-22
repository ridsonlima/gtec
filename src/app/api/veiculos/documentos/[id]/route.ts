import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

const PODE = ['master', 'admin', 'manager', 'supervisor']

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  await prisma.veiculoDocumento.deleteMany({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
