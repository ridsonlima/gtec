'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Send, AlertCircle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface ReportFormData {
  title: string
  period: string
  executiveSummary: string
  evolutions: string
  criticalPoints: string
  attentionPoints: string
  risks: string
  blockers: string
  decisionsNeeded: string
  nextSteps: string
  pendingItems: string
  agendaSuggestion: string
}

export default function EditarReportPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()

  const [form, setForm] = useState<ReportFormData | null>(null)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['report', params.id],
    queryFn: () => fetch(`/api/reports/${params.id}`).then((r) => r.json()),
  })

  useEffect(() => {
    if (data?.data) {
      const r = data.data
      setForm({
        title:            r.title           ?? '',
        period:           r.period          ?? '',
        executiveSummary: r.executiveSummary ?? '',
        evolutions:       r.evolutions      ?? '',
        criticalPoints:   r.criticalPoints  ?? '',
        attentionPoints:  r.attentionPoints ?? '',
        risks:            r.risks           ?? '',
        blockers:         r.blockers        ?? '',
        decisionsNeeded:  r.decisionsNeeded ?? '',
        nextSteps:        r.nextSteps       ?? '',
        pendingItems:     r.pendingItems    ?? '',
        agendaSuggestion: r.agendaSuggestion ?? '',
      })
    }
  }, [data])

  const set = (key: keyof ReportFormData) =>
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      setForm((f) => f ? { ...f, [key]: e.target.value } : f)

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!form?.title.trim()) throw new Error('Título obrigatório')

      const res = await fetch(`/api/reports/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')

      if (publish) {
        const pubRes = await fetch(`/api/reports/${params.id}/publish`, { method: 'POST' })
        if (!pubRes.ok) throw new Error('Erro ao publicar')
      }

      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report', params.id] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      router.push(`/reports/${params.id}`)
    },
    onError: (e: any) => setError(e.message),
  })

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const Section = ({
    label, field, placeholder, icon, rows = 4,
  }: {
    label: string; field: keyof ReportFormData
    placeholder: string; icon?: string; rows?: number
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </label>
      <textarea
        rows={rows}
        value={form[field]}
        onChange={set(field)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   placeholder:text-gray-300"
      />
    </div>
  )

  const isDraft = data?.data?.status === 'draft'

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/reports/${params.id}`}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao report
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Editar Report</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => saveMutation.mutate(false)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200
                       text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
          {isDraft && (
            <button
              onClick={() => saveMutation.mutate(true)}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white
                         text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Publicar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200
                        text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Informações gerais */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Informações Gerais
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Período de referência</label>
          <input
            type="text"
            value={form.period}
            onChange={set('period')}
            placeholder="Ex: Semana 19/2026, Maio/2026..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Conteúdo do Report
        </h2>

        <Section label="Resumo Executivo" field="executiveSummary" placeholder="Parágrafo objetivo sobre o período..." rows={3} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Evoluções" field="evolutions" placeholder="• O que avançou no período?" />
          <Section label="Próximos Passos" field="nextSteps" placeholder="• O que acontece na próxima semana?" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="border border-red-100 rounded-lg p-4 bg-red-50/30">
            <Section label="Pontos Críticos" field="criticalPoints" icon="🔴" placeholder="Situações que exigem ação imediata..." />
          </div>
          <div className="border border-amber-100 rounded-lg p-4 bg-amber-50/30">
            <Section label="Pontos de Atenção" field="attentionPoints" icon="🟡" placeholder="Situações para monitorar..." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Riscos" field="risks" icon="⛔" placeholder="Riscos identificados..." />
          <Section label="Bloqueios" field="blockers" icon="🚧" placeholder="O que está impedindo o avanço?" />
        </div>

        <div className="border border-blue-100 rounded-lg p-4 bg-blue-50/30">
          <Section label="Decisões Necessárias" field="decisionsNeeded" icon="⚡" placeholder="O que precisa de decisão da diretoria?" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Pendências" field="pendingItems" icon="📋" placeholder="Itens ainda abertos..." />
          <Section label="Sugestão de Pauta" field="agendaSuggestion" icon="📅" placeholder="Tópicos para a próxima reunião..." />
        </div>
      </div>

      {/* Botões inferiores */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={() => router.push(`/reports/${params.id}`)}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={() => saveMutation.mutate(false)}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200
                     text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Salvar
        </button>
        {isDraft && (
          <button
            onClick={() => saveMutation.mutate(true)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                       text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending
              ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              : <Send className="w-4 h-4" />}
            Publicar
          </button>
        )}
      </div>
    </div>
  )
}
