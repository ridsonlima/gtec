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
  viewer:     'Visualizador',
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}
