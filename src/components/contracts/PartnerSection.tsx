'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake, Pencil, Trash2, Save, X } from 'lucide-react'

interface Partner {
  id: string
  name: string
  cnpj: string | null
  contactName: string | null
  contactPhone: string | null
  percentageGlobal: number
}

interface Props {
  contractId: string
  partner: Partner | null
  canEdit: boolean
}

export function PartnerSection({ contractId, partner, canEdit }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(!partner)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: partner?.name ?? '',
    cnpj: partner?.cnpj ?? '',
    contactName: partner?.contactName ?? '',
    contactPhone: partner?.contactPhone ?? '',
    percentageGlobal: partner?.percentageGlobal?.toString() ?? '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/parceiro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setEditing(false)
    router.refresh()
  }

  async function remove() {
    if (!confirm('Remover parceiro deste contrato?')) return
    setLoading(true)
    await fetch(`/api/contracts/${contractId}/parceiro`, { method: 'DELETE' })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <Handshake className="w-4 h-4" />
          Parceiro
        </h2>
        {canEdit && partner && !editing && (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={remove} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {!editing && partner ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Info label="Empresa" value={partner.name} />
          <Info label="% Global" value={`${partner.percentageGlobal}%`} />
          {partner.cnpj && <Info label="CNPJ" value={partner.cnpj} />}
          {partner.contactName && <Info label="Contato" value={partner.contactName} />}
          {partner.contactPhone && <Info label="Telefone" value={partner.contactPhone} />}
        </div>
      ) : canEdit ? (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Empresa *">
              <input required value={form.name} onChange={set('name')} className="input" placeholder="Razão social" />
            </Field>
            <Field label="% Global *">
              <input required type="number" min="0" max="100" step="0.01" value={form.percentageGlobal} onChange={set('percentageGlobal')} className="input" placeholder="Ex: 15.5" />
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
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />{loading ? 'Salvando...' : 'Salvar'}
            </button>
            {partner && (
              <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
                <X className="w-3.5 h-3.5" />Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-400">Nenhum parceiro vinculado.</p>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
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
