/**
 * Mapeamento de roles internos para labels exibidos na interface.
 * Alinhado com a hierarquia real da CDG Engenharia:
 * master/admin → Administrador
 * director     → Diretor
 * manager      → Coordenador
 * supervisor   → Supervisor
 * viewer       → Visualizador
 */
export const ROLE_LABELS: Record<string, string> = {
  master:     'Administrador',
  admin:      'Administrador',
  director:   'Diretor',
  manager:    'Coordenador',
  supervisor: 'Supervisor',
  viewer:     'Técnico',
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

// Funções selecionáveis em novos cadastros (vocabulário da CDG; sem "master" legado).
export const ASSIGNABLE_ROLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'director', label: 'Diretor' },
  { value: 'manager', label: 'Coordenador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'viewer', label: 'Técnico' },
]
