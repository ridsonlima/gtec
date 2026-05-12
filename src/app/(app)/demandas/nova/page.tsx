'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, AlertCircle } from 'lucide-react'

interface DemandFormData {
  areaId: string
  contractId: string
  title: string
  context: string
  priority: string
  origin: string
  responsibleId: string
  dueDate: string
  reportId: string
}

const EMPTY: DemandFormData = {
  areaId: '', contractId: '', title: '', context: '',
  priority: 'medium', origin: 'director', responsibleId: '', dueDate: '', reportId: '',
}

const PRIORITY_OPTIONS = [
  { value: 'critical', label: '🔴 Crítica' },
  { value: 'high',     label: '🟠 Alta' },
  { value: 'medium',   label: '🔵 Média' },
  { value: 'low',      label: '⚪ Baixa' },
]

const ORIGIN_OPTIONS = [
  { value: 'director',  label: 'Diretoria' },
  { value: 'manager',   label: 'Gerência' },
  { value: 'report',    label: 'Report' },
  { value: 'contract',  label: 'Contrato' },
  { value: 'audit',     label: 'Auditoria' },
  { value: 'other',     label: 'Outro' },
]

export default function NovaDemandaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const preAreaId   = searchParams.get('areaId')   ?? ''
  const preReportId = searchParams.get('reportId') ?? ''

  const [form, setForm] = useState<DemandFormData>({
    ...EMPTY,
    areaId: preAreaId,
    reportId: preReportId,
    origin: preReportId ? 'report' : 'director',
  })
  const [error, setError] = useState('')

  const set = (key: keyof DemandFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const { data: areasData } = useQuery({
    queryKey: ['areas'],
    queryFn: () => fetch('/api/areas').then((r) => r.json()),
  })

  const { data: contractsData } = useQuery({
    queryKey: ['contracts', form.areaId],
    queryFn: () => fetch(`/api/contracts?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: !!form.areaId,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-area', form.areaId],
    queryFn: () => fetch(`/api/users?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: !!form.areaId,
  })

  const areas     = areasData?.data ?? []
  const contracts = contractsData?.data ?? []
  const users     = usersData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim())       throw new Error('Título obrigatório')
      if (!form.areaId)             throw new Error('Selecione uma área')
      if (!form.responsibleId)      throw new Error('Selecione um responsável')
      if (!form.dueDate)            throw new Error('Informe o prazo')

      const res = await fetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contractId: form.contractId || null,
          reportId:   form.reportId   || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar demanda')
      return json.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['demands'] })
      router.push(`/demandas/${data.id}`)
    },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nova Demanda</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registre uma demanda de acompanhamento para uma área ou contrato
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200
                        text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* Área e Contrato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área <span className="text-red-500">*</span>
            </label>
            <select
              value={form.areaId}
              onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, contractId: '', responsibleId: '' }))}
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

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="Ex: Apresentar cronograma atualizado da obra X"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contexto / Descrição (opcional)
          </label>
          <textarea
            rows={3}
            value={form.context}
            onChange={set('context')}
            placeholder="Detalhe o que precisa ser feito, contexto e critério de conclusão..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Responsável e Prazo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsável <span className="text-red-500">*</span>
            </label>
            <select
              value={form.responsibleId}
              onChange={set('responsibleId')}
              disabled={!form.areaId}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {form.areaId ? 'Selecione o responsável...' : 'Selecione uma área primeiro'}
              </option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prazo <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={set('dueDate')}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Prioridade e Origem */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridade
            </label>
            <select
              value={form.priority}
              onChange={set('priority')}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Origem
            </label>
            <select
              value={form.origin}
              onChange={set('origin')}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Report de origem */}
        {preReportId && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
            📋 Esta demanda será vinculada ao report que a originou.
          </div>
        )}
      </div>

      {/* Botões */}
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
          Criar Demanda
        </button>
      </div>
    </div>
  )
}
