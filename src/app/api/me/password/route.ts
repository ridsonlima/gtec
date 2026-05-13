import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Nao autenticado', 401)

  const body = await req.json()
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')

  if (!currentPassword || !newPassword) return apiError('Informe a senha atual e a nova senha', 400)
  if (newPassword.length < 6) return apiError('A nova senha deve ter pelo menos 6 caracteres', 400)

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return apiError('Usuario nao encontrado', 404)

  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) return apiError('Senha atual incorreta', 400)

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

  return apiSuccess({ ok: true })
}
