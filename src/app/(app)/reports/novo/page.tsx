'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Send, AlertCircle } from 'lucide-react'

interface ReportFormData {
  areaId: string
  contractId: string
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

const EMPTY: ReportFormData = {
  areaId: '', contractId: '', title: '', period: '',
  executiveSummary: '', evolutions: '', criticalPoints: '',
  attentionPoints: '', risks: '', blockers: '',
  decisionsNeeded: '', nextSteps: '', pendingItems: '',
  agendaSuggestion: '',
}

export default function NovoReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const preAreaId = searchParams.get('areaId') ?? ''

  const [form, setForm] = useState<ReportFormData>({ ...EMPTY, areaId: preAreaId })
  const [error, setError] = useState('')

  const { data: areasData } = useQuery({
    queryKey: ['areas'],
    queryFn: () => fetch('/api/areas').then((r) => r.json()),
  })

  const { data: contractsData } = useQuery({
    queryKey: ['contracts', form.areaId],
    queryFn: () => fetch(`/api/contracts?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: !!form.areaId,
  })

  const areas = areasData?.data ?? []
  const contracts = contractsData?.data?.filter((c: any) => c.area?.isOperational) ?? []

  const set = (key: keyof ReportFormData) => (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!form.title.trim()) throw new Error('Título obrigatório')
      if (!form.areaId) throw new Error('Selecione uma área')

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contractId: form.contractId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')

      const reportId = json.data.id

      if (publish) {
        const pubRes = await fetch(`/api/reports/${reportId}/publish`, { method: 'POST' })
        if (!pubRes.ok) throw new Error('Erro ao publicar')
      }

      return { reportId, published: publish }
    },
    onSuccess: ({ reportId }) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      router.push(`/reports/${reportId}`)
    },
    onError: (e: any) => setError(e.message),
  })

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
        value={form[field] as string}
        onChange={set(field)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   placeholder:text-gray-300"
      />
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Novo Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registre o estado e as evoluções da sua área
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => saveMutation.mutate(false)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200
                       text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors
                       disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Salvar rascunho
          </button>
          <button
            onClick={() => saveMutation.mutate(true)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white
                       text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors
                       disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Publicar Report
          </button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área <span className="text-red-500">*</span>
            </label>
            <select
              value={form.areaId}
              onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, contractId: '' }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione a área...</option>
              {areas.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrato (opcional)
            </label>
            <select
              value={form.contractId}
              onChange={set('contractId')}
              disabled={!form.areaId || contracts.length === 0}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Sem contrato específico</option>
              {contracts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.number} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="Ex: Semana 19/2026 — Obras Próprias"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período de referência
          </label>
          <input
            type="text"
            value={form.period}
            onChange={set('period')}
            placeholder="Ex: Semana 19/2026, Maio/2026, Q2 2026..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Conteúdo do report */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Conteúdo do Report
        </h2>
        <p className="text-xs text-gray-400 -mt-3">
          Todos os campos são opcionais — preencha apenas o que for relevante para o período.
        </p>

        <Section
          label="Resumo Executivo"
          field="executiveSummary"
          placeholder="Escreva um parágrafo objetivo sobre o período. O que aconteceu? Qual foi o resultado geral?"
          rows={3}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section
            label="Evoluções"
            field="evolutions"
            placeholder="• O que avançou no período?&#10;• Marcos concluídos&#10;• Realizações relevantes"
          />
          <Section
            label="Próximos Passos"
            field="nextSteps"
            placeholder="• O que acontece na próxima semana?&#10;• Ações planejadas&#10;• Entregas previstas"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="border border-red-100 rounded-lg p-4 bg-red-50/30">
            <Section
              label="Pontos Críticos"
              field="criticalPoints"
              icon="🔴"
              placeholder="Situações que exigem ação imediata ou decisão. Impactos reais ou iminentes."
            />
          </div>
          <div className="border border-amber-100 rounded-lg p-4 bg-amber-50/30">
            <Section
              label="Pontos de Atenção"
              field="attentionPoints"
              icon="🟡"
              placeholder="Situações para monitorar. Não críticas ainda, mas que merecem acompanhamento."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section
            label="Riscos"
            field="risks"
            icon="⛔"
            placeholder="Riscos identificados que podem impactar o contrato, prazo ou qualidade."
          />
          <Section
            label="Bloqueios"
            field="blockers"
            icon="🚧"
            placeholder="O que está impedindo o avanço? Aguardando aprovação, material, decisão..."
          />
        </div>

        <div className="border border-blue-100 rounded-lg p-4 bg-blue-50/30">
          <Section
            label="Decisões Necessárias"
            field="decisionsNeeded"
            icon="⚡"
            placeholder="O que precisa de decisão ou autorização da diretoria? Seja específico."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section
            label="Pendências"
            field="pendingItems"
            icon="📋"
            placeholder="Itens ainda abertos de períodos anteriores ou do período atual."
          />
          <Section
            label="Sugestão de Pauta"
            field="agendaSuggestion"
            icon="📅"
            placeholder="Tópicos que devem entrar na próxima reunião da diretoria."
          />
        </div>
      </div>

      {/* Botões inferiores */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={() => saveMutation.mutate(false)}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200
                     text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors
                     disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Salvar rascunho
        </button>
        <button
          onClick={() => saveMutation.mutate(true)}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                     text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors
                     disabled:opacity-50"
        >
          {saveMutation.isPending
            ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            : <Send className="w-4 h-4" />}
          Publicar Report
        </button>
      </div>
    </div>
  )
}
