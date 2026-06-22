import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

type Params = { params: { id: string } }
const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  await prisma.obraAvancoFisico.deleteMany({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
