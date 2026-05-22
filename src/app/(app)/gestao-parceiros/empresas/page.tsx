'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, Pencil, Save, X, ChevronRight, Check, AlertCircle } from 'lucide-react'

interface EmpresaParceira {
  id: string
  name: string
  cnpj: string | null
  contactName: string | null
  contactPhone: string | null
  isActive: boolean
  _count?: { contractPartners: number }
}

const EMPTY_FORM = { name: '', cnpj: '', contactName: '', contactPhone: '', isActive: true }

export default function EmpresasPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY_FORM>>({})
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['empresas-parceiras'],
    queryFn: () => fetch('/api/empresas-parceiras').then((r) => r.json()),
  })

  const empresas: EmpresaParceira[] = data?.data ?? []

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/empresas-parceiras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    if (!res.ok) { setError(d?.error ?? 'Erro ao criar empresa'); return }
    setAdding(false)
    setForm(EMPTY_FORM)
    qc.invalidateQueries({ queryKey: ['empresas-parceiras'] })
  }

  async function salvar(id: string) {
    setError('')
    const res = await fetch(`/api/empresas-parceiras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const d = await res.json()
    if (!res.ok) { setError(d?.error ?? 'Erro ao salvar'); return }
    setEditingId(null)
    qc.invalidateQueries({ queryKey: ['empresas-parceiras'] })
  }

  const setF = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const setEF = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))

  function startEdit(emp: EmpresaParceira) {
    setEditingId(emp.id)
    setEditForm({ name: emp.name, cnpj: emp.cnpj ?? '', contactName: emp.contactName ?? '', contactPhone: emp.contactPhone ?? '' })
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/gestao-parceiros" className="hover:text-gray-600">Gestão de Parceiros</Link>
        <span>/</span>
        <span className="text-gray-600">Empresas Parceiras</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            Empresas Parceiras
          </h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de empresas parceiras e seus dados fiscais</p>
        </div>
        <button
          onClick={() => { setAdding(true); setError('') }}
          className="inline-flex items-center gap-2 px-3 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nova empresa
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {adding && (
        <form onSubmit={criar} className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Nova empresa parceira</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FField label="Nome da empresa *">
              <input required value={form.name} onChange={setF('name')} className="input" placeholder="Razão social" />
            </FField>
            <FField label="CNPJ">
              <input value={form.cnpj} onChange={setF('cnpj')} className="input" placeholder="00.000.000/0000-00" />
            </FField>
            <FField label="Nome do contato">
              <input value={form.contactName} onChange={setF('contactName')} className="input" placeholder="Responsável comercial" />
            </FField>
            <FField label="Telefone/WhatsApp">
              <input value={form.contactPhone} onChange={setF('contactPhone')} className="input" placeholder="(85) 99999-9999" />
            </FField>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90">
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM) }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading && <div className="text-sm text-gray-400">Carregando...</div>}

      {!isLoading && empresas.length === 0 && !adding && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhuma empresa parceira cadastrada
        </div>
      )}

      <div className="space-y-2">
        {empresas.map((emp) => {
          const isEditing = editingId === emp.id
          return (
            <div key={emp.id} className={`bg-white rounded-xl border ${emp.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'} p-4`}>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FField label="Nome da empresa *">
                      <input required value={editForm.name ?? ''} onChange={setEF('name')} className="input" />
                    </FField>
                    <FField label="CNPJ">
                      <input value={editForm.cnpj ?? ''} onChange={setEF('cnpj')} className="input" placeholder="00.000.000/0000-00" />
                    </FField>
                    <FField label="Nome do contato">
                      <input value={editForm.contactName ?? ''} onChange={setEF('contactName')} className="input" />
                    </FField>
                    <FField label="Telefone/WhatsApp">
                      <input value={editForm.contactPhone ?? ''} onChange={setEF('contactPhone')} className="input" />
                    </FField>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => salvar(emp.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cdg-blue text-white text-sm rounded-lg hover:opacity-90">
                      <Save className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                      {!emp.isActive && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inativa</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      {emp.cnpj && <span>CNPJ: {emp.cnpj}</span>}
                      {emp.contactName && <span>Contato: {emp.contactName}</span>}
                      {emp.contactPhone && <span>Tel: {emp.contactPhone}</span>}
                      {emp._count !== undefined && (
                        <span className="text-blue-600 font-medium">{emp._count.contractPartners} contrato{emp._count.contractPartners !== 1 ? 's' : ''} vinculado{emp._count.contractPartners !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => startEdit(emp)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 space-y-1"><span>{label}</span>{children}</label>
}
