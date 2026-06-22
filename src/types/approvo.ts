// ─── Tipos do módulo de Aprovações (Approvo) ────────────────────────────────

export type ApprovoTipoDocumento =
  | 'Mapa de Cotação'
  | 'Medição de Contrato'
  | 'Solicitação de Obra'
  | 'Pedido de Compra'
  | 'Aditivo Contratual'

export type ApprovoContrato =
  | 'PDD'
  | 'UNMTL'
  | 'CE-6'
  | 'Transnordestina'
  | 'Taquarão'

export type ApprovoCriticidade = 'normal' | 'atencao' | 'critico'

// Etapa da cadeia de aprovação (alçada)
export type ApprovoEtapaStatus = 'aprovado' | 'pendente' | 'aguardando'

export interface ApprovoEtapa {
  ordem: number
  nome: string          // nome da etapa/alçada (ex: "Coordenação", "Diretoria Técnica")
  aprovador: string     // nome do responsável pela etapa
  cargo?: string        // cargo/papel do aprovador
  status: ApprovoEtapaStatus // aprovado (já passou) | pendente (aprovador atual) | aguardando (na fila)
  data?: string         // ISO — quando foi aprovado
}

export interface ApprovoAlert {
  id: string
  tipo_documento: ApprovoTipoDocumento | string   // tipos conhecidos ou "Documento Approvo"
  numero_documento: string          // número do documento no Approvo (ex: "2214", "325")
  descricao: string
  filial: string                    // ex: "Consorcio Taquarao - Filial"
  solicitante: string               // quem abriu a solicitação (ex: "Ana Clivia")
  contrato_vinculado: ApprovoContrato | string // filial/obra vinculada
  projeto?: string                  // ex: "Obras Taquarão"
  centro_custo: string              // ex: "Produção Própria"
  valor: number
  status: string
  data_criacao: string // ISO
  dias_pendente: number
  criticidade: ApprovoCriticidade
  link_approvo: string
  etapas: ApprovoEtapa[]                              // cadeia de aprovação (alçada)
  proximo_aprovador: { nome: string; etapa: string; cargo?: string } | null
  chave_completa?: string           // chave do documento no Approvo (deep-link futuro)
  chave_encriptada?: string         // chave encriptada para acesso direto
  origem?: 'real' | 'mock'          // de onde vieram os dados
}

export interface ApprovoSummary {
  quantidadePendente: number
  valorTotalPendente: number
  quantidadeCritica: number
  aprovacaoMaisAntiga: { dias: number; descricao: string; numero: string } | null
}

export const CRITICIDADE_META: Record<ApprovoCriticidade, { label: string; cls: string }> = {
  normal:  { label: 'Normal',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  atencao: { label: 'Atenção',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  critico: { label: 'Crítico',  cls: 'bg-red-50 text-red-700 border-red-200' },
}

export const ETAPA_META: Record<ApprovoEtapaStatus, { label: string; dot: string; text: string }> = {
  aprovado:   { label: 'Aprovado',        dot: 'bg-green-500', text: 'text-green-700' },
  pendente:   { label: 'Aprovador atual', dot: 'bg-blue-500',  text: 'text-blue-700' },
  aguardando: { label: 'Na fila',         dot: 'bg-gray-300',  text: 'text-gray-400' },
}
