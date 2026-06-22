// ─── Controle de funcionários (Segurança) — catálogo e regras ────────────────

export const VINCULO_LABEL: Record<string, string> = {
  proprio: 'Próprio',
  terceirizado: 'Terceirizado',
}

export const SITUACAO_LABEL: Record<string, string> = {
  contratado: 'Contratado',
  avulso: 'Avulso',
}

export const REGIME_LABEL: Record<string, string> = {
  diaria: 'Diária',
  clt: 'CLT',
  pj: 'PJ',
}

// Treinamentos de segurança mais comuns (NRs) — usados como checklist padrão.
export const TREINAMENTOS_PADRAO: { nome: string; descricao: string; validadeMeses?: number }[] = [
  { nome: 'Integração', descricao: 'Orientações iniciais de SST na admissão do trabalhador.' },
  { nome: 'NR-01', descricao: 'Disposições gerais e gerenciamento de riscos ocupacionais (GRO/PGR).' },
  { nome: 'NR-05', descricao: 'CIPA — Comissão Interna de Prevenção de Acidentes.', validadeMeses: 12 },
  { nome: 'NR-06', descricao: 'Seleção, uso e conservação de EPI (Equipamento de Proteção Individual).' },
  { nome: 'NR-10', descricao: 'Segurança em instalações e serviços com eletricidade.', validadeMeses: 24 },
  { nome: 'NR-11', descricao: 'Transporte, movimentação, armazenagem e manuseio de materiais.' },
  { nome: 'NR-12', descricao: 'Segurança na operação de máquinas e equipamentos.' },
  { nome: 'NR-17', descricao: 'Ergonomia: adaptação do trabalho às condições do trabalhador.' },
  { nome: 'NR-18', descricao: 'Condições e meio ambiente de trabalho na indústria da construção.' },
  { nome: 'NR-20', descricao: 'Segurança e saúde no trabalho com inflamáveis e combustíveis.', validadeMeses: 36 },
  { nome: 'NR-23', descricao: 'Prevenção e combate a incêndios / brigada de emergência.', validadeMeses: 12 },
  { nome: 'NR-33', descricao: 'Trabalho em espaços confinados (entrada e supervisão).', validadeMeses: 12 },
  { nome: 'NR-35', descricao: 'Trabalho em altura acima de 2 metros.', validadeMeses: 24 },
  { nome: 'Primeiros Socorros', descricao: 'Atendimento inicial a vítimas até a chegada do socorro.', validadeMeses: 24 },
]

export type TreinamentoStatus = 'ok' | 'a_vencer' | 'vencido' | 'pendente'

export const TREINAMENTO_STATUS_META: Record<TreinamentoStatus, { label: string; color: string }> = {
  ok:       { label: 'Em dia',    color: 'green' },
  a_vencer: { label: 'A vencer',  color: 'amber' },
  vencido:  { label: 'Vencido',   color: 'red' },
  pendente: { label: 'Pendente',  color: 'gray' },
}

/**
 * Calcula o status de um treinamento a partir da data de realização e validade.
 * - pendente: não realizado
 * - vencido: validade no passado
 * - a_vencer: validade nos próximos 30 dias
 * - ok: realizado e válido
 */
export function statusTreinamento(
  realizadoEm: Date | string | null | undefined,
  validade: Date | string | null | undefined,
  hoje: Date = new Date()
): TreinamentoStatus {
  if (!realizadoEm) return 'pendente'
  if (!validade) return 'ok'
  const val = new Date(validade)
  const diffDias = Math.floor((val.getTime() - hoje.getTime()) / 86_400_000)
  if (diffDias < 0) return 'vencido'
  if (diffDias <= 30) return 'a_vencer'
  return 'ok'
}

/** Resumo de treinamentos de um funcionário (para badges/alertas). */
export function resumoTreinamentos(
  treinamentos: { realizadoEm: Date | string | null; validade: Date | string | null }[],
  hoje: Date = new Date()
): { ok: number; aVencer: number; vencidos: number; pendentes: number; total: number; criticos: number } {
  let ok = 0, aVencer = 0, vencidos = 0, pendentes = 0
  for (const t of treinamentos) {
    const s = statusTreinamento(t.realizadoEm, t.validade, hoje)
    if (s === 'ok') ok++
    else if (s === 'a_vencer') aVencer++
    else if (s === 'vencido') vencidos++
    else pendentes++
  }
  return {
    ok,
    aVencer,
    vencidos,
    pendentes,
    total: treinamentos.length,
    criticos: vencidos + pendentes,
  }
}
