import type { Session } from 'next-auth'
import { prisma } from './prisma'

type UserRole = 'admin' | 'director' | 'manager' | 'supervisor' | 'viewer'

// ─── VERIFICAÇÕES SIMPLES ─────────────────────────────────────────────────────

export function isAdmin(role: UserRole) {
  return role === 'admin'
}

export function isDirector(role: UserRole) {
  return role === 'director' || role === 'admin'
}

export function isManagerOrAbove(role: UserRole) {
  return ['admin', 'director', 'manager'].includes(role)
}

// ─── VERIFICAÇÃO DE ESCOPO DE ÁREA ────────────────────────────────────────────

/**
 * Verifica se o usuário tem acesso à área.
 * Director e admin têm acesso global.
 * Manager/supervisor precisam ter escopo na área.
 */
export function canAccessArea(
  session: Session,
  areaId: string,
  requireWrite = false
): boolean {
  const { role } = session.user

  // Acesso global
  if (role === 'admin' || role === 'director') return true

  // Verifica nos escopos carregados no token (sem banco)
  const scope = session.user.areaScopes.find((s) => s.areaId === areaId)
  if (!scope) return false
  if (requireWrite && !scope.canWrite) return false

  return true
}

/**
 * Retorna os areaIds que o usuário pode acessar.
 * Para director/admin, retorna null (acesso global).
 */
export function getUserAreaIds(session: Session): string[] | null {
  const { role, areaScopes } = session.user
  if (role === 'admin' || role === 'director') return null
  return areaScopes.map((s) => s.areaId)
}

// ─── VERIFICAÇÕES DE OBJETOS ──────────────────────────────────────────────────

export function canCreateReport(session: Session, areaId: string): boolean {
  const { role } = session.user
  if (role === 'admin' || role === 'director') return false // diretor não cria report
  return canAccessArea(session, areaId, true)
}

export function canEditReport(session: Session, authorId: string): boolean {
  const { role, id } = session.user
  if (role === 'admin') return true
  return id === authorId
}

export function canPublishReport(session: Session, authorId: string): boolean {
  const { role, id } = session.user
  if (role === 'admin') return true
  if (role === 'manager') return id === authorId
  return false
}

export function canCreateDemand(session: Session, areaId: string): boolean {
  const { role } = session.user
  if (role === 'admin' || role === 'director') return true
  if (role === 'manager') return canAccessArea(session, areaId)
  return false
}

export function canUpdateDemand(
  session: Session,
  demand: { responsibleId: string; areaId: string }
): boolean {
  const { role, id } = session.user
  if (role === 'admin' || role === 'director') return true
  if (role === 'manager') return canAccessArea(session, demand.areaId)
  if (role === 'supervisor') return demand.responsibleId === id
  return false
}

export function canComment(session: Session, areaId?: string): boolean {
  const { role } = session.user
  if (role === 'admin' || role === 'director') return true
  if (!areaId) return false
  return canAccessArea(session, areaId)
}

export function canRequestEvidence(session: Session): boolean {
  const { role } = session.user
  return role === 'admin' || role === 'director' || role === 'manager'
}

export function canManageUsers(session: Session): boolean {
  return session.user.role === 'admin'
}

export function canManageContracts(session: Session): boolean {
  return session.user.role === 'admin'
}

export function canCreateAgenda(session: Session): boolean {
  const { role } = session.user
  return role === 'admin' || role === 'director'
}
