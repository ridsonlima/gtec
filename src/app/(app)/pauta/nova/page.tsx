'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Trash2, AlertCircle, GripVertical, Users, Building2, Globe } from 'lucide-react'

type Tipo = 'diretoria' | 'interarea' | 'externo'

interface AgendaItem {
  tempId: string
  title: string
  description: string
  origin: string
  reportId: string
  demandId: string
  estimatedMinutes: string
}

function newItem(origin = 'director'): AgendaItem {
  return {
    tempId: Math.random().toString(36).slice(2),
    title: '', description: '', origin,
    reportId: '', demandId: '', estimatedMinutes: '',
  }
}

const ORIGIN_OPTIONS = [
  { value: 'director',  label: 'Diretoria' },
  { value: 'area',      label: 'Área' },
  { value: 'report',    label: 'Report' },
  { value: 'demand',    label: 'Demanda' },
  { value: 'contract',  label: 'Contrato' },
  { value: 'recurring', label: 'Recorrente' },
  { value: 'other',     label: 'Outro' },
]

const TIPO_CONFIG: Record<Tipo, { label: string; icon: React.ReactNode; desc: string; defaultOrigin: string }> = {
  diretoria: {
    label: 'Com a Diretoria',
    icon: <Users className="w-4 h-4" />,
    desc: 'Reunião de área(s) com a diretoria executiva',
    defaultOrigin: 'director',
  },
  interarea: {
    label: 'Entre Áreas',
    icon: <Building2 className="w-4 h-4" />,
    desc: 'Reunião entre duas ou mais áreas internas',
    defaultOrigin: 'area',
  },
  externo: {
    label: 'Com Público Externo',
    icon: <Globe className="w-4 h-4" />,
    desc: 'Reunião com parceiros, clientes ou entidades externas',
    defaultOrigin: 'other',
  },
}

export default function NovaPautaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const preReportId = searchParams.get('reportId') ?? ''

  const [tipo, setTipo]                     = useState<Tipo>('diretoria')
  const [title, setTitle]                   = useState('')
  const [objective, setObjective]           = useState('')
  const [scheduledAt, setScheduledAt]       = useState('')
  const [participantesExternos, setParticipantesExternos] = useState('')
  const [areasSelected, setAreasSelected]   = useState<string[]>([])
  const [items, setItems]                   = useState<AgendaItem[]>([newItem()])
  const [error, setError]                   = useState('')

  // Busca áreas disponíveis (para interárea) — exclui áreas container (ex: Sala Técnica)
  const { data: areasData } = useQuery({
    queryKey: ['areas-list', 'leaf'],
    queryFn: () => fetch('/api/areas?leafOnly=true').then((r) => r.json()),
    enabled: tipo === 'interarea',
  })
  const areas: any[] = areasData?.data ?? []

  // Pre-fill report data
  const { data: reportData } = useQuery({
    queryKey: ['report', preReportId],
    queryFn: () => fetch(`/api/reports/${preReportId}`).then((r) => r.json()),
    enabled: !!preReportId,
  })

  useEffect(() => {
    if (reportData?.data && !title) {
      setTitle(`Reunião — ${reportData.data.title}`)
      setItems((prev) =>
        prev.map((item, i) =>
          i === 0 && item.reportId === preReportId
            ? { ...item, title: `Discussão: ${reportData.data.title}` }
            : item
        )
      )
    }
  }, [reportData])

  // Quando muda o tipo, atualiza o item padrão
  useEffect(() => {
    setItems([newItem(TIPO_CONFIG[tipo].defaultOrigin)])
  }, [tipo])

  const updateItem = (tempId: string, key: keyof AgendaItem, value: string) =>
    setItems((prev) => prev.map((it) => it.tempId === tempId ? { ...it, [key]: value } : it))

  const removeItem = (tempId: string) =>
    setItems((prev) => prev.filter((it) => it.tempId !== tempId))

  function toggleArea(id: string) {
    setAreasSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Título da reunião obrigatório')
      if (items.some((i) => !i.title.trim())) throw new Error('Todos os itens precisam de título')
      if (tipo === 'interarea' && areasSelected.length < 1) throw new Error('Selecione pelo menos uma área')

      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          objective: objective || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          tipo,
          areasEnvolvidas: tipo === 'interarea' ? areasSelected : [],
          participantesExternos: tipo === 'externo' ? (participantesExternos || null) : null,
          items: items.map((it, idx) => ({
            title: it.title,
            description: it.description || null,
            origin: it.origin,
            reportId: it.reportId || null,
            demandId: it.demandId || null,
            estimatedMinutes: it.estimatedMinutes ? parseInt(it.estimatedMinutes) : null,
            order: idx,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar pauta')
      return json.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['agenda'] })
      router.push(`/pauta/${data.id}`)
    },
    onError: (e: any) => setError(e.message),
  })

  const totalMinutes = items.reduce((acc, i) => acc + (parseInt(i.estimatedMinutes) || 0), 0)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nova Pauta</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organize a próxima reunião</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tipo de reunião */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tipo de Reunião</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(TIPO_CONFIG) as [Tipo, typeof TIPO_CONFIG[Tipo]][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTipo(key)}
              className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                tipo === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`flex items-center gap-2 font-medium text-sm ${tipo === key ? 'text-blue-700' : 'text-gray-700'}`}>
                {cfg.icon}
                {cfg.label}
              </div>
              <p className="text-xs text-gray-500 leading-snug">{cfg.desc}</p>
            </button>
          ))}
        </div>

        {/* Áreas envolvidas — só para interárea */}
        {tipo === 'interarea' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Áreas envolvidas <span className="text-red-500">*</span>
            </label>
            {areas.length === 0 ? (
              <p className="text-xs text-gray-400">Carregando áreas...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {areas.map((a: any) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleArea(a.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      areasSelected.includes(a.id)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
            {areasSelected.length > 0 && (
              <p className="text-xs text-teal-600 mt-2">{areasSelected.length} área(s) selecionada(s)</p>
            )}
          </div>
        )}

        {/* Participantes externos */}
        {tipo === 'externo' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Participantes / entidade externa <span className="text-xs text-gray-400 font-normal">(indicativo)</span>
            </label>
            <input
              type="text"
              value={participantesExternos}
              onChange={(e) => setParticipantesExternos(e.target.value)}
              placeholder="Ex: Empresa X, Prefeitura de Y, Fiscalização DNIT..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Dados da reunião */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dados da Reunião</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              tipo === 'diretoria' ? 'Ex: Reunião com Diretoria — Obras Próprias' :
              tipo === 'interarea' ? 'Ex: Alinhamento Sesmt × Equipamentos' :
              'Ex: Reunião com Prefeitura — Licença Ambiental'
            }
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data/hora da reunião</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            {totalMinutes > 0 && (
              <p className="text-sm text-gray-500">
                ⏱ Total estimado: <strong>{totalMinutes}min</strong>
                {' '}({Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? `${totalMinutes % 60}min` : ''})
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo / contexto (opcional)</label>
          <textarea
            rows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="O que precisa ser tratado ou decidido nesta reunião?"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Itens da pauta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Itens da Pauta ({items.length})
          </h2>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newItem(TIPO_CONFIG[tipo].defaultOrigin)])}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" /> Adicionar item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.tempId} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/30">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.tempId, 'title', e.target.value)}
                  placeholder="Título do item *"
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.tempId)}
                  disabled={items.length === 1}
                  className="p-1.5 text-gray-300 hover:text-red-400 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 ml-9">
                <div>
                  <select
                    value={item.origin}
                    onChange={(e) => updateItem(item.tempId, 'origin', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ORIGIN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    value={item.estimatedMinutes}
                    onChange={(e) => updateItem(item.tempId, 'estimatedMinutes', e.target.value)}
                    placeholder="Tempo (min)"
                    min={1}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="ml-9">
                <textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => updateItem(item.tempId, 'description', e.target.value)}
                  placeholder="Detalhes, contexto ou material de apoio (opcional)"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending
            ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            : <Save className="w-4 h-4" />}
          Criar Pauta
        </button>
      </div>
    </div>
  )
}
