'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardHat, Plus, Trash2, Save, X } from 'lucide-react'

interface Contractor {
  id: string
  name: string
  cnpj: string | null
  contactName: string | null
  contactPhone: string | null
  serviceDescription: string
  contractedValue: number
}

interface Props {
  contractId: string
  contractors: Contractor[]
  canEdit: boolean
}

const EMPTY_FORM = {
  name: '',
  cnpj: '',
  contactName: '',
  contactPhone: '',
  serviceDescription: '',
  contractedValue: '',
}

export function ContractorsSection({ contractId, contractors, canEdit }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/empreiteiros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setAdding(false)
    setForm(EMPTY_FORM)
    router.refresh()
  }

  async function remove(emprId: string, name: string) {
    if (!confirm(`Remover empreiteiro "${name}"?`)) return
    await fetch(`/api/contracts/${contractId}/empreiteiros/${emprId}`, { method: 'DELETE' })
    router.refresh()
  }

  const totalContratado = contractors.reduce((sum, c) => sum + c.contractedValue, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <HardHat className="w-4 h-4" />
          Empreiteiros ({contractors.length})
          {contractors.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              Total: {formatCurrency(totalContratado)}
            </span>
          )}
        </h2>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" />Adicionar
          </button>
        )}
      </div>

      {contractors.length === 0 && !adding && (
        <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
          Nenhum empreiteiro vinculado
        </div>
      )}

      {contractors.length > 0 && (
        <div className="space-y-3 mb-4">
          {contractors.map((c) => (
            <div key={c.id} className="border border-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.serviceDescription}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    <span className="text-xs text-gray-400">Valor: <span className="font-medium text-gray-700">{formatCurrency(c.contractedValue)}</span></span>
                    {c.cnpj && <span className="text-xs text-gray-400">CNPJ: {c.cnpj}</span>}
                    {c.contactName && <span className="text-xs text-gray-400">Contato: {c.contactName}</span>}
                    {c.contactPhone && <span className="text-xs text-gray-400">{c.contactPhone}</span>}
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => remove(c.id, c.name)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={add} className="border border-blue-100 bg-blue-50/30 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Novo empreiteiro</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Empresa *">
              <input required value={form.name} onChange={set('name')} className="input" placeholder="Razão social" />
            </Field>
            <Field label="Valor contratado (R$) *">
              <input required type="number" min="0" step="0.01" value={form.contractedValue} onChange={set('contractedValue')} className="input" placeholder="0,00" />
            </Field>
            <Field label="CNPJ">
              <input value={form.cnpj} onChange={set('cnpj')} className="input" placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="Contato">
              <input value={form.contactName} onChange={set('contactName')} className="input" placeholder="Nome do responsável" />
            </Field>
            <Field label="Telefone">
              <input value={form.contactPhone} onChange={set('contactPhone')} className="input" placeholder="(00) 00000-0000" />
            </Field>
          </div>
          <Field label="Serviço contratado *">
            <textarea required value={form.serviceDescription} onChange={set('serviceDescription')} className="input min-h-16" placeholder="Descreva o serviço específico" />
          </Field>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />{loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM) }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" />Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  )
}
