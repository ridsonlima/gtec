'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, Save, AlertTriangle } from 'lucide-react'

const CONTRACT_TYPES = ['Empreitada global', 'Preco unitario', 'Manutencao', 'Servico tecnico', 'Fornecimento', 'Outro']
const READJUSTMENT_INDEXES = ['INPC', 'IPCA', 'IGP-M', 'IGP-DI', 'IPC-A', 'SINAPI', 'Outro']
const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'at_risk', label: 'Em risco' },
  { value: 'delayed', label: 'Atrasado' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'completed', label: 'Concluido' },
]

export default function EditContractPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [originalModality, setOriginalModality] = useState('')
  const [form, setForm] = useState({
    areaId: '', responsibleId: '', number: '', name: '', client: '', contractType: '', object: '',
    estimatedValue: '', startDate: '', endDate: '', status: 'active',
    executionModality: 'own_crew', physicalProgress: '', financialProgress: '', riskNotes: '',
    proposalDate: '', readjustmentCount: '0', readjustmentIndex: '',
  })

  const { data: contractData, isLoading } = useQuery({
    queryKey: ['contract', params.id],
    queryFn: () => fetch(`/api/contracts/${params.id}`).then((r) => r.json()),
  })
  const { data: partnersData } = useQuery({
    queryKey: ['contract-partners', params.id],
    queryFn: () => fetch(`/api/contracts/${params.id}/partners`).then((r) => r.json()),
  })
  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const { data: usersData } = useQuery({
    queryKey: ['users-area', form.areaId],
    queryFn: () => fetch(`/api/users?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId),
  })

  useEffect(() => {
    const c = contractData?.data
    if (!c) return
    const modality = c.executionModality ?? 'own_crew'
    setOriginalModality(modality)
    setForm({
      areaId: c.areaId ?? '',
      responsibleId: c.responsibleId ?? '',
      number: c.number ?? '',
      name: c.name ?? '',
      client: c.client ?? '',
      contractType: c.contractType ?? '',
      object: c.description ?? '',
      estimatedValue: c.estimatedValue != null ? String(c.estimatedValue) : '',
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
      status: c.status ?? 'active',
      executionModality: modality,
      physicalProgress: c.physicalProgress != null ? String(c.physicalProgress) : '',
      financialProgress: c.financialProgress != null ? String(c.financialProgress) : '',
      riskNotes: c.riskNotes ?? '',
      proposalDate: c.proposalDate ? c.proposalDate.slice(0, 10) : '',
      readjustmentCount: c.readjustmentCount != null ? String(c.readjustmentCount) : '0',
      readjustmentIndex: c.readjustmentIndex ?? '',
    })
  }, [contractData])

  const areas = areasData?.data ?? []
  const users = usersData?.data ?? []
  const partners = partnersData?.data ?? []
  const hasPartners = partners.length > 0
  const modalityChanged = form.executionModality !== originalModality && originalModality !== ''

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (modalityChanged && hasPartners) {
      const ok = confirm(
        'ATENÇÃO: Este contrato já possui parceiros e medições vinculados.\n\nTrocar a modalidade pode causar inconsistências nos dados.\n\nDeseja continuar mesmo assim?'
      )
      if (!ok) return
    }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/contracts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data?.error) {
      setError(data?.error ?? 'Não foi possível salvar o contrato')
      return
    }
    router.push(`/contratos/${params.id}`)
    router.refresh()
  }

  if (isLoading) return <div className="text-sm text-gray-500">Carregando contrato...</div>

  return (
    <div className="max-w-3xl space-y-5">
      <Link href={`/contratos/${params.id}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" />Voltar ao contrato
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar contrato</h1>
        <p className="text-sm text-gray-500 mt-1">Atualize dados principais, prazo, valor e progresso.</p>
      </div>
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

        {modalityChanged && hasPartners && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> Este contrato tem {partners.length} parceiro(s) e medições vinculados.
              Trocar a modalidade pode causar inconsistências — os dados de parceiros e medições serão mantidos mas podem não aparecer corretamente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Area">
            <select required value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, responsibleId: '' }))} className="input">
              <option value="">Selecione</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Responsavel">
            <select value={form.responsibleId} onChange={set('responsibleId')} className="input" disabled={!form.areaId}>
              <option value="">Selecione</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Numero"><input required value={form.number} onChange={set('number')} className="input" /></Field>
          <Field label="Tipo de contrato">
            <select value={form.contractType} onChange={set('contractType')} className="input">
              <option value="">Sem tipo definido</option>{CONTRACT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Contratante/cliente"><input required value={form.client} onChange={set('client')} className="input" /></Field>
          <Field label="Valor global"><input type="number" min="0" step="0.01" value={form.estimatedValue} onChange={set('estimatedValue')} className="input" /></Field>
          <Field label="Inicio"><input type="date" value={form.startDate} onChange={set('startDate')} className="input" /></Field>
          <Field label="Termino"><input type="date" value={form.endDate} onChange={set('endDate')} className="input" /></Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className="input">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Modalidade de execucao">
            <select value={form.executionModality} onChange={set('executionModality')} className={`input ${modalityChanged && hasPartners ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}>
              <option value="own_crew">Equipe propria</option>
              <option value="partner">Parceiro (% global)</option>
              <option value="contractor">Empreiteiro (servico especifico)</option>
            </select>
          </Field>
          <Field label="Avanco fisico (%)"><input type="number" min="0" max="100" value={form.physicalProgress} onChange={set('physicalProgress')} className="input" placeholder="0" /></Field>
          <Field label="Avanco financeiro (%)"><input type="number" min="0" max="100" value={form.financialProgress} onChange={set('financialProgress')} className="input" placeholder="0" /></Field>
          <Field label="Data da proposta">
            <input type="date" value={form.proposalDate} onChange={set('proposalDate')} className="input" />
          </Field>
          <Field label="Índice de reajuste">
            <select value={form.readjustmentIndex} onChange={set('readjustmentIndex')} className="input">
              <option value="">Não definido</option>
              {READJUSTMENT_INDEXES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Reajustes aplicados">
            <input type="number" min="0" value={form.readjustmentCount} onChange={set('readjustmentCount')} className="input" placeholder="0" />
          </Field>
        </div>
        <Field label="Nome resumido"><input required value={form.name} onChange={set('name')} className="input" /></Field>
        <Field label="Objeto"><textarea required value={form.object} onChange={set('object')} className="input min-h-28" /></Field>
        <Field label="Observacoes"><textarea value={form.riskNotes} onChange={set('riskNotes')} className="input min-h-24" /></Field>

        <div className="flex justify-end gap-2 pt-2">
          <Link href={`/contratos/${params.id}`} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</Link>
          <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            <Save className="w-4 h-4" />{loading ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 space-y-1"><span>{label}</span>{children}</label>
}
