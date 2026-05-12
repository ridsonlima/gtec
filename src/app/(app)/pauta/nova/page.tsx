'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Trash2, AlertCircle, GripVertical } from 'lucide-react'

interface AgendaItem {
  tempId: string
  title: string
  description: string
  origin: string
  reportId: string
  demandId: string
  estimatedMinutes: string
}

function newItem(): AgendaItem {
  return {
    tempId: Math.random().toString(36).slice(2),
    title: '', description: '', origin: 'director',
    reportId: '', demandId: '', estimatedMinutes: '',
  }
}

const ORIGIN_OPTIONS = [
  { value: 'director',  label: 'Diretoria' },
  { value: 'report',    label: 'Report' },
  { value: 'demand',    label: 'Demanda' },
  { value: 'contract',  label: 'Contrato' },
  { value: 'recurring', label: 'Recorrente' },
  { value: 'other',     label: 'Outro' },
]

export default function NovaPautaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const preReportId = searchParams.get('reportId') ?? ''

  const [title, setTitle]         = useState('')
  const [objective, setObjective] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [items, setItems] = useState<AgendaItem[]>([
    preReportId
      ? { ...newItem(), origin: 'report', reportId: preReportId }
      : newItem(),
  ])
  const [error, setError] = useState('')

  // Pre-fill report title if coming from report
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

  const updateItem = (tempId: string, key: keyof AgendaItem, value: string) =>
    setItems((prev) => prev.map((it) => it.tempId === tempId ? { ...it, [key]: value } : it))

  const removeItem = (tempId: string) =>
    setItems((prev) => prev.filter((it) => it.tempId !== tempId))

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Título da reunião obrigatório')
      if (items.some((i) => !i.title.trim())) throw new Error('Todos os itens precisam de título')

      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          objective: objective || null,
          scheduledAt: scheduledAt || null,
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
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nova Pauta</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Organize a próxima reunião da diretoria
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Meeting info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Dados da Reunião
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Reunião Semanal de Diretoria — Semana 19/2026"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data/hora da reunião
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            {totalMinutes > 0 && (
              <p className="text-sm text-gray-500">
                ⏱ Tempo estimado total: <strong>{totalMinutes}min</strong>
                {' '}({Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? `${totalMinutes % 60}min` : ''})
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Objetivo / contexto (opcional)
          </label>
          <textarea
            rows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="O que precisa ser decidido nesta reunião?"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Itens da Pauta ({items.length})
          </h2>
          <button
            onClick={() => setItems((prev) => [...prev, newItem()])}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Adicionar item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={item.tempId}
              className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/30"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.tempId, 'title', e.target.value)}
                  placeholder="Título do item *"
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
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
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs
                               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs
                               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="ml-9">
                <textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => updateItem(item.tempId, 'description', e.target.value)}
                  placeholder="Detalhes, contexto ou material de apoio (opcional)"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                     text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
