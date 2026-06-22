import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

const MANAGER_ROLES = ['master', 'admin', 'director']

function canManageUsers(role?: string) {
  return Boolean(role && MANAGER_ROLES.includes(role))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageUsers(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').toLowerCase().trim()
  const role = String(body.role ?? '').trim()
  const areaIds = Array.isArray(body.areaIds) ? body.areaIds.filter(Boolean) : []

  if (!name || !email || !role) {
    return apiError('Nome, e-mail e perfil são obrigatórios', 400)
  }

  const currentUser = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, role: true } })
  if (!currentUser || !currentUser.id) return apiError('Usuário não encontrado', 404)

  const emailInUse = await prisma.user.findFirst({ where: { email, id: { not: params.id } }, select: { id: true } })
  if (emailInUse) return apiError('Já existe usuário com este e-mail', 409)

  if (currentUser.role === 'master' && role !== 'master') {
    const activeMasters = await prisma.user.count({ where: { role: 'master', isActive: true } })
    if (activeMasters <= 1) return apiError('Não é possível remover o último usuário master', 400)
  }

  const toIntOrNull = (v: unknown) => (v === '' || v == null ? null : Number.isNaN(Number(v)) ? null : Number(v))

  const userData: any = {
    name, email, role,
    approvoTipoAcesso:     body.approvoTipoAcesso ? String(body.approvoTipoAcesso) : 'C',
    approvoCodUsuario:     toIntOrNull(body.approvoCodUsuario),
    approvoCodPerfil:      toIntOrNull(body.approvoCodPerfil),
    approvoCodUsuarioMega: toIntOrNull(body.approvoCodUsuarioMega),
  }
  if (body.password && String(body.password).trim()) {
    userData.passwordHash = await bcrypt.hash(String(body.password), 12)
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: params.id }, data: userData })
    await tx.userAreaScope.deleteMany({ where: { userId: params.id } })

    if (areaIds.length) {
      await tx.userAreaScope.createMany({
        data: areaIds.map((areaId: string, index: number) => ({
          userId: params.id,
          areaId,
          canWrite: Boolean(body.canWrite),
          isPrimary: index === 0,
        })),
        skipDuplicates: true,
      })
    }

    return tx.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        areaScopes: { select: { areaId: true, canWrite: true, isPrimary: true } },
      },
    })
  })

  return apiSuccess(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageUsers(session.user.role)) return apiError('Sem permissão', 403)
  if (session.user.id === params.id) return apiError('Você não pode excluir o próprio usuário', 400)

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, role: true, isActive: true } })
  if (!target || !target.isActive) return apiError('Usuário não encontrado', 404)

  if (target.role === 'master') {
    const activeMasters = await prisma.user.count({ where: { role: 'master', isActive: true } })
    if (activeMasters <= 1) return apiError('Não é possível excluir o último usuário master', 400)
  }

  await prisma.user.update({ where: { id: params.id }, data: { isActive: false } })

  return apiSuccess({ deleted: true })
}
