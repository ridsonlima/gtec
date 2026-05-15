'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Filter, Download } from 'lucide-react'

interface Area { id: string; name: string }

interface Props {
  areas: Area[]
  requestingAreaId: string
  areaId: string
  status: string
  acceptanceStatus: string
  dateFrom: string
  dateTo: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const ACCEPTANCE_OPTIONS = [
  { value: '', label: 'Todos os aceites' },
  { value: 'pending_acceptance', label: 'Aguardando aceite' },
  { value: 'accepted', label: 'Aceita' },
  { value: 'rejected', label: 'Rejeitada' },
]

export function InterareaFilters({
  areas, requestingAreaId, areaId, status, acceptanceStatus, dateFrom, dateTo,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function navigate(params: Partial<Props>) {
    const p = new URLSearchParams()
    const merged = { requestingAreaId, areaId, status, acceptanceStatus, dateFrom, dateTo, ...params }
    if (merged.requestingAreaId) p.set('requestingAreaId', merged.requestingAreaId)
    if (merged.areaId) p.set('areaId', merged.areaId)
    if (merged.status) p.set('status', merged.status)
    if (merged.acceptanceStatus) p.set('acceptanceStatus', merged.acceptanceStatus)
    if (merged.dateFrom) p.set('dateFrom', merged.dateFrom)
    if (merged.dateTo) p.set('dateTo', merged.dateTo)
    const s = p.toString()
    startTransition(() => { router.push(`/relatorio-interarea${s ? '?' + s : ''}`) })
  }

  function buildExportUrl() {
    const p = new URLSearchParams()
    if (requestingAreaId) p.set('requestingAreaId', requestingAreaId)
    if (areaId) p.set('areaId', areaId)
    if (status) p.set('status', status)
    if (acceptanceStatus) p.set('acceptanceStatus', acceptanceStatus)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    const s = p.toString()
    return `/api/demands/export${s ? '?' + s : ''}`
  }

  const hasFilters = requestingAreaId || areaId || status || acceptanceStatus || dateFrom || dateTo

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Filter className="w-4 h-4" />
        <span className="font-medium">Filtros</span>
      </div>

      <select
        value={requestingAreaId}
        onChange={(e) => navigate({ requestingAreaId: e.target.value })}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Área Solicitante</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <select
        value={areaId}
        onChange={(e) => navigate({ areaId: e.target.value })}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Área Executora</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <select
        value={acceptanceStatus}
        onChange={(e) => navigate({ acceptanceStatus: e.target.value })}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {ACCEPTANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select
        value={status}
        onChange={(e) => navigate({ status: e.target.value })}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input
        type="date"
        value={dateFrom}
        onChange={(e) => navigate({ dateFrom: e.target.value })}
        title="De"
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <input
        type="date"
        value={dateTo}
        onChange={(e) => navigate({ dateTo: e.target.value })}
        title="Até"
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {hasFilters && (
        <button
          onClick={() => navigate({ requestingAreaId: '', areaId: '', status: '', acceptanceStatus: '', dateFrom: '', dateTo: '' })}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Limpar
        </button>
      )}

      <div className="ml-auto">
        <a
          href={buildExportUrl()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </a>
      </div>
    </div>
  )
}
