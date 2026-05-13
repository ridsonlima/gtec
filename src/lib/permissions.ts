import type { Session } from 'next-auth'

type UserRole = 'master' | 'admin' | 'director' | 'manager' | 'supervisor' | 'viewer'

export function isAdmin(role: UserRole) {
  return role === 'master' || role === 'admin'
}

export function isDirector(role: UserRole) {
  return role === 'master' || role === 'director' || role === 'admin'
}

export function isManagerOrAbove(role: UserRole) {
  return ['master', 'admin', 'director', 'manager'].includes(role)
}

export function canAccessArea(
  session: Session,
  areaId: string,
  requireWrite = false
): boolean {
  const { role } = session.user

  if (role === 'master' || role === 'admin' || role === 'director') return true

  const scope = session.user.areaScopes.find((s) => s.areaId === areaId)
  if (!scope) return false
  if (requireWrite && !scope.canWrite) return false

  return true
}

export function getUserAreaIds(session: Session): string[] | null {
  const { role, areaScopes } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return null
  return areaScopes.map((s) => s.areaId)
}

export function canCreateReport(session: Session, areaId: string): boolean {
  const { role } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return false
  return canAccessArea(session, areaId, true)
}

export function canEditReport(session: Session, authorId: string): boolean {
  const { role, id } = session.user
  if (role === 'master' || role === 'admin') return true
  return id === authorId
}

export function canPublishReport(session: Session, authorId: string): boolean {
  const { role, id } = session.user
  if (role === 'master' || role === 'admin') return true
  if (role === 'manager') return id === authorId
  return false
}

export function canCreateDemand(session: Session, areaId: string): boolean {
  const { role } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return true
  if (role === 'manager') return canAccessArea(session, areaId)
  return false
}

export function canUpdateDemand(
  session: Session,
  demand: { responsibleId: string; areaId: string }
): boolean {
  const { role, id } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return true
  if (role === 'manager') return canAccessArea(session, demand.areaId)
  if (role === 'supervisor') return demand.responsibleId === id
  return false
}

export function canComment(session: Session, areaId?: string): boolean {
  const { role } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return true
  if (!areaId) return false
  return canAccessArea(session, areaId)
}

export function canRequestEvidence(session: Session): boolean {
  const { role } = session.user
  return role === 'master' || role === 'admin' || role === 'director' || role === 'manager'
}

export function canManageUsers(session: Session): boolean {
  return ['master', 'admin', 'director'].includes(session.user.role)
}

export function canManageContracts(session: Session): boolean {
  return ['master', 'admin', 'director'].includes(session.user.role)
}

export function canCreateAgenda(session: Session): boolean {
  const { role } = session.user
  return role === 'master' || role === 'admin' || role === 'director'
}
