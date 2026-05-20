export type WidgetId =
  | 'alerts'
  | 'contracts-expiring'
  | 'sla-interarea'
  | 'area-status'
  | 'critical-demands'
  | 'activity-feed'
  | 'contracts-risk'
  | 'awaiting-decision'
  | 'recent-comments'

export interface WidgetMeta {
  id: WidgetId
  label: string
  description: string
}

export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: 'alerts',             label: 'Alertas',              description: 'Cards de contagem: demandas vencidas, evidências, SLA, contratos em risco' },
  { id: 'contracts-expiring', label: 'Contratos Vencendo',   description: 'Aviso de contratos com vencimento nos próximos 30 dias' },
  { id: 'sla-interarea',      label: 'SLA Interárea',        description: 'Aceites interárea com SLA em risco ou vencido' },
  { id: 'area-status',        label: 'Situação por Área',    description: 'Tabela com status de cada área (relatório, demandas, contratos)' },
  { id: 'critical-demands',   label: 'Demandas Críticas',    description: 'Demandas com prioridade crítica ou vencidas' },
  { id: 'activity-feed',      label: 'Feed de Atividades',   description: 'Atualizações recentes de demandas em tempo real' },
  { id: 'contracts-risk',     label: 'Contratos em Atenção', description: 'Contratos com status "em risco" ou "atrasado"' },
  { id: 'awaiting-decision',  label: 'Aguardando Decisão',   description: 'Reports publicados que precisam de decisão' },
  { id: 'recent-comments',    label: 'Interações Recentes',  description: 'Comentários recentes em demandas e reports' },
]

const DEFAULT_ORDER: WidgetId[] = [
  'alerts',
  'contracts-expiring',
  'sla-interarea',
  'area-status',
  'critical-demands',
  'activity-feed',
  'contracts-risk',
  'awaiting-decision',
  'recent-comments',
]

const DEFAULT_VISIBLE = new Set<WidgetId>(DEFAULT_ORDER)

const KEY_ORDER   = 'dash:widget-order'
const KEY_VISIBLE = 'dash:widget-visible'

export function loadDashPrefs(): { order: WidgetId[]; visible: Set<WidgetId> } {
  if (typeof window === 'undefined') return { order: DEFAULT_ORDER, visible: DEFAULT_VISIBLE }
  try {
    const rawOrder   = localStorage.getItem(KEY_ORDER)
    const rawVisible = localStorage.getItem(KEY_VISIBLE)
    const allIds = new Set(WIDGET_CATALOG.map((w) => w.id))

    // Merge stored order with any new widgets added since last save
    const storedOrder: WidgetId[] = rawOrder
      ? (JSON.parse(rawOrder) as WidgetId[]).filter((id) => allIds.has(id))
      : [...DEFAULT_ORDER]

    // Add any new widgets (not yet in stored order) at the end
    for (const id of DEFAULT_ORDER) {
      if (!storedOrder.includes(id)) storedOrder.push(id)
    }

    const visible: Set<WidgetId> = rawVisible
      ? new Set((JSON.parse(rawVisible) as WidgetId[]).filter((id) => allIds.has(id)))
      : new Set(DEFAULT_VISIBLE)

    return { order: storedOrder, visible }
  } catch {
    return { order: DEFAULT_ORDER, visible: DEFAULT_VISIBLE }
  }
}

export function saveDashPrefs(order: WidgetId[], visible: Set<WidgetId>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY_ORDER,   JSON.stringify(order))
  localStorage.setItem(KEY_VISIBLE, JSON.stringify(Array.from(visible)))
}
