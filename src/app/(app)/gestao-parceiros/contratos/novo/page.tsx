'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Save, Handshake } from 'lucide-react'

const CONTRACT_TYPES = ['Empreitada global', 'Preco unitario', 'Manutencao', 'Servico tecnico', 'Fornecimento', 'Outro']

export default function NovoContratoParceiroPag() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    areaId: '', responsibleId: '', number: '', name: '', client: '',
    contractType: '', object: '', estimatedValue: '', executionDays: '',
    startDate: new Date().toISOString().slice(0, 10), status: 'active',
    executionModality: 'partner',
  })

  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const { data: usersData } = useQuery({
    queryKey: ['users-area', form.areaId],
    queryFn: () => fetch(`/api/users?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId),
  })

  const areas = areasData?.data ?? []
  const users = usersData?.data ?? []
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data?.success === false) {
      setError(data?.error ?? 'Não foi possível criar o contrato')
      return
    }
    router.push(`/contratos/${data.data.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/gestao-parceiros" className="hover:text-gray-600">Gestão de Parceiros</Link>
        <span>/</span>
        <Link href="/gestao-parceiros/contratos" className="hover:text-gray-600">Contratos</Link>
        <span>/</span>
        <span className="text-gray-600">Novo</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Handshake className="w-5 h-5 text-blue-500" />
          Novo contrato de parceiro
        </h1>
        <p className="text-sm text-gray-500 mt-1">Contrato de faturamento executado em modalidade parceiro.</p>
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Handshake className="w-4 h-4 flex-shrink-0" />
          Modalidade: <strong>Parceiro (% global)</strong> — gerenciado em Gestão de Parceiros
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Area">
            <select required value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, responsibleId: '' }))} className="input">
              <option value="">Selecione</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Responsavel">
            <select value={form.responsibleId} onChange={set('responsibleId')} className="input" disabled={!form.areaId}>
              <option value="">Selecione</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Numero do contrato">
            <input required value={form.number} onChange={set('number')} className="input" placeholder="Ex: CDG-001/2026" />
          </Field>
          <Field label="Tipo de contrato">
            <select required value={form.contractType} onChange={set('contractType')} className="input">
              <option value="">Selecione</option>
              {CONTRACT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Contratante (cliente)">
            <input required value={form.client} onChange={set('client')} className="input" placeholder="Ex: Cagece" />
          </Field>
          <Field label="Valor global do contrato">
            <input type="number" min="0" step="0.01" value={form.estimatedValue} onChange={set('estimatedValue')} className="input" placeholder="0,00" />
          </Field>
          <Field label="Data de inicio">
            <input type="date" value={form.startDate} onChange={set('startDate')} className="input" />
          </Field>
          <Field label="Prazo de execucao (dias)">
            <input required type="number" min="1" value={form.executionDays} onChange={set('executionDays')} className="input" />
          </Field>
        </div>

        <Field label="Nome resumido">
          <input required value={form.name} onChange={set('name')} className="input" placeholder="Nome para localizar o contrato" />
        </Field>
        <Field label="Objeto do contrato">
          <textarea required value={form.object} onChange={set('object')} className="input min-h-28" placeholder="Descreva o objeto contratado" />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/gestao-parceiros/contratos" className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</Link>
          <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Criar contrato'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 space-y-1"><span>{label}</span>{children}</label>
}
