'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  { value: 'critical', label: 'Critica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baixa' },
]

const ORIGIN_OPTIONS = [
  { value: 'director', label: 'Diretoria' },
  { value: 'manager', label: 'Coordenação' },
  { value: 'report', label: 'Report' },
  { value: 'contract', label: 'Contrato' },
  { value: 'audit', label: 'Auditoria' },
  { value: 'other', label: 'Outro' },
]

export default function NovaDemandaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const preAreaId = searchParams.get('areaId') ?? ''
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

  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const { data: contractsData } = useQuery({
    queryKey: ['contracts', form.areaId],
    queryFn: () => fetch(`/api/contracts?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId),
  })
  const { data: usersData } = useQuery({
    queryKey: ['users-area', form.areaId],
    queryFn: () => fetch(`/api/users?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId),
  })

  const areas = areasData?.data ?? []
  const contracts = contractsData?.data ?? []
  const users = usersData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Titulo obrigatorio')
      if (!form.areaId) throw new Error('Selecione uma área')
      if (!form.responsibleId) throw new Error('Selecione um responsavel')
      if (!form.dueDate) throw new Error('Informe o prazo')

      const res = await fetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contractId: form.contractId || null, reportId: form.reportId || null }),
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
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nova Demanda</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registre uma demanda de acompanhamento para uma área ou contrato.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Area" required>
            <select value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, contractId: '', responsibleId: '' }))} className="input">
              <option value="">Selecione a área...</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          <Field label="Contrato (opcional)">
            <select value={form.contractId} onChange={set('contractId')} disabled={!form.areaId} className="input disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">Sem contrato especifico</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.number} - {c.name}</option>)}
            </select>
            {form.areaId && contracts.length === 0 && (
              <Link href={`/contratos/novo?areaId=${form.areaId}`} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                Nenhum contrato nesta área. Cadastrar contrato
              </Link>
            )}
          </Field>
        </div>

        <Field label="Titulo" required>
          <input type="text" value={form.title} onChange={set('title')} placeholder="Ex: Apresentar cronograma atualizado da obra" className="input" />
        </Field>

        <Field label="Contexto / descricao (opcional)">
          <textarea rows={3} value={form.context} onChange={set('context')} placeholder="Detalhe o que precisa ser feito, contexto e criterio de conclusao." className="input resize-y" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Responsável" required>
            <select value={form.responsibleId} onChange={set('responsibleId')} disabled={!form.areaId} className="input disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">{form.areaId ? 'Selecione o responsável...' : 'Selecione uma área primeiro'}</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </Field>
          <Field label="Prazo" required>
            <input type="date" value={form.dueDate} onChange={set('dueDate')} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prioridade">
            <select value={form.priority} onChange={set('priority')} className="input">{PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </Field>
          <Field label="Origem">
            <select value={form.origin} onChange={set('origin')} className="input">{ORIGIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </Field>
        </div>

        {preReportId && <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">Esta demanda sera vinculada ao report que a originou.</div>}
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saveMutation.isPending ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
          Criar Demanda
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 space-y-1">
      <span>{label} {required && <span className="text-red-500">*</span>}</span>
      {children}
    </label>
  )
}
