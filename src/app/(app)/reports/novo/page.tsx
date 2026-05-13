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
  areaId: '', contractId: '', title: '', period: '', executiveSummary: '', evolutions: '',
  criticalPoints: '', attentionPoints: '', risks: '', blockers: '', decisionsNeeded: '',
  nextSteps: '', pendingItems: '', agendaSuggestion: '',
}

export default function NovoReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const preAreaId = searchParams.get('areaId') ?? ''
  const preContractId = searchParams.get('contractId') ?? ''
  const [form, setForm] = useState<ReportFormData>({ ...EMPTY, areaId: preAreaId, contractId: preContractId })
  const [error, setError] = useState('')

  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const { data: contractsData } = useQuery({
    queryKey: ['contracts', form.areaId],
    queryFn: () => fetch(`/api/contracts?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId),
  })

  const areas = areasData?.data ?? []
  const contracts = contractsData?.data ?? []
  const set = (key: keyof ReportFormData) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!form.title.trim()) throw new Error('Titulo obrigatorio')
      if (!form.areaId) throw new Error('Selecione uma area')

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contractId: form.contractId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')

      if (publish) {
        const pubRes = await fetch(`/api/reports/${json.data.id}/publish`, { method: 'POST' })
        if (!pubRes.ok) throw new Error('Erro ao publicar')
      }
      return json.data.id
    },
    onSuccess: (reportId) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      router.push(`/reports/${reportId}`)
    },
    onError: (e: any) => setError(e.message),
  })

  const Section = ({ label, field, placeholder, rows = 4 }: { label: string; field: keyof ReportFormData; placeholder: string; rows?: number }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea rows={rows} value={form[field] as string} onChange={set(field)} placeholder={placeholder} className="input resize-y placeholder:text-gray-300" />
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Novo Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registre o estado e as evolucoes da sua area.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"><Save className="w-4 h-4" />Salvar rascunho</button>
          <button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"><Send className="w-4 h-4" />Publicar Report</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg"><AlertCircle className="w-4 h-4" />{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informacoes Gerais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area <span className="text-red-500">*</span></label>
            <select value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, contractId: '' }))} className="input">
              <option value="">Selecione a area...</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrato (opcional)</label>
            <select value={form.contractId} onChange={set('contractId')} disabled={!form.areaId} className="input disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">Sem contrato especifico</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.number} - {c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titulo <span className="text-red-500">*</span></label>
          <input type="text" value={form.title} onChange={set('title')} placeholder="Ex: Semana 19/2026 - Obras Proprias" className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periodo de referencia</label>
          <input type="text" value={form.period} onChange={set('period')} placeholder="Ex: Semana 19/2026, Maio/2026, Q2 2026" className="input" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Conteudo do Report</h2>
        <p className="text-xs text-gray-400 -mt-3">Todos os campos sao opcionais. Preencha apenas o que for relevante para o periodo.</p>
        <Section label="Resumo Executivo" field="executiveSummary" placeholder="Resumo objetivo do periodo." rows={3} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Evolucoes" field="evolutions" placeholder="O que avancou no periodo?" />
          <Section label="Proximos Passos" field="nextSteps" placeholder="O que acontece na proxima semana?" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Pontos Criticos" field="criticalPoints" placeholder="Situacoes que exigem acao imediata." />
          <Section label="Pontos de Atencao" field="attentionPoints" placeholder="Situacoes para monitorar." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Riscos" field="risks" placeholder="Riscos que podem impactar contrato, prazo ou qualidade." />
          <Section label="Bloqueios" field="blockers" placeholder="O que esta impedindo o avanco?" />
        </div>
        <Section label="Decisoes Necessarias" field="decisionsNeeded" placeholder="O que precisa de decisao ou autorizacao da diretoria?" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section label="Pendencias" field="pendingItems" placeholder="Itens ainda abertos." />
          <Section label="Sugestao de Pauta" field="agendaSuggestion" placeholder="Topicos para a proxima reuniao." />
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
        <button onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"><Save className="w-4 h-4" />Salvar rascunho</button>
        <button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">{saveMutation.isPending ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Send className="w-4 h-4" />}Publicar Report</button>
      </div>
    </div>
  )
}
