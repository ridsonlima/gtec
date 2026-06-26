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

// Quem pode criar/editar rotinas de uma área (inclui supervisor da área).
export function canManageRotina(role: UserRole) {
  return ['master', 'admin', 'director', 'manager', 'supervisor'].includes(role)
}

// Quem pode VISUALIZAR o módulo CDG Rental / Equipamentos (a equipe da área, em
// qualquer nível). As ações de gerir continuam gated por isManagerOrAbove dentro
// de cada tela.
export function canViewRental(session: Session): boolean {
  if (isManagerOrAbove(session.user.role)) return true
  return (session.user.areaScopes ?? []).some((s: any) => {
    const n = (s.areaName ?? '').toLowerCase()
    return n.includes('rental') || n.includes('equipamento')
  })
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

type DemandAccess = {
  areaId: string
  requestingAreaId?: string | null
  responsibleId: string
  collaboratorUserIds?: string[]
}

export function canAccessDemand(session: Session, demand: DemandAccess): boolean {
  const { role, id, areaScopes } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return true
  const userAreaIds = areaScopes.map((s) => s.areaId)
  if (userAreaIds.includes(demand.areaId)) return true
  if (demand.requestingAreaId && userAreaIds.includes(demand.requestingAreaId)) return true
  if (demand.responsibleId === id) return true
  if (demand.collaboratorUserIds?.includes(id)) return true
  return false
}

// Editar/mudar status/apagar a demanda. Técnico (viewer) NÃO entra aqui — fica de
// supervisor pra cima (supervisor: suas demandas; manager+: a área toda).
export function canUpdateDemand(session: Session, demand: DemandAccess): boolean {
  const { role, id } = session.user
  if (role === 'master' || role === 'admin' || role === 'director') return true
  if (role === 'manager') {
    return canAccessArea(session, demand.areaId) ||
      (demand.requestingAreaId ? canAccessArea(session, demand.requestingAreaId) : false)
  }
  if (role === 'supervisor') {
    return demand.responsibleId === id || (demand.collaboratorUserIds?.includes(id) ?? false)
  }
  return false
}

// "Atualizar": registrar evolução, comentar, anexar — SEM editar/apagar nem mudar
// status. Liberado para qualquer membro da área (ex.: técnico atualiza as demandas
// da sua área) e colaboradores convidados.
export function canContributeToDemand(session: Session, demand: DemandAccess): boolean {
  if (canUpdateDemand(session, demand)) return true
  if (canAccessArea(session, demand.areaId)) return true
  if (demand.requestingAreaId && canAccessArea(session, demand.requestingAreaId)) return true
  return demand.collaboratorUserIds?.includes(session.user.id) ?? false
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

/**
 * Controle de funcionários (Segurança): gestores e acima OU qualquer usuário
 * cujo escopo de área seja de Segurança/SESMT/Meio Ambiente.
 */
export function isSegurancaTeam(session: Session): boolean {
  return session.user.areaScopes.some((s) =>
    /segur|sesmt|ambiente|seg\.?\s*do\s*trab/i.test(s.areaName)
  )
}

export function canManageFuncionarios(session: Session): boolean {
  return isManagerOrAbove(session.user.role) || isSegurancaTeam(session)
}

/** Gerenciar dados do dashboard de Segurança (mesma regra dos funcionários). */
export function canManageSeguranca(session: Session): boolean {
  return isManagerOrAbove(session.user.role) || isSegurancaTeam(session)
}
