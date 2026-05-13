'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Save, Users } from 'lucide-react'

const ROLES = [
  { value: 'director', label: 'Diretor' },
  { value: 'manager', label: 'Coordenador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'viewer', label: 'Visualizador' },
  { value: 'admin', label: 'Administrador' },
]

export default function UsersAdminPage() {
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', areaIds: [] as string[], canWrite: false })

  const { data: usersData } = useQuery({ queryKey: ['admin-users'], queryFn: () => fetch('/api/users').then((r) => r.json()) })
  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const users = usersData?.data ?? []
  const areas = areasData?.data ?? []

  function toggleArea(areaId: string) {
    setForm((f) => ({ ...f, areaIds: f.areaIds.includes(areaId) ? f.areaIds.filter((id) => id !== areaId) : [...f.areaIds, areaId] }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data?.success === false) {
      setError(data?.error ?? 'Não foi possível criar o usuário')
      return
    }
    setSuccess('Usuario criado com sucesso')
    setForm({ name: '', email: '', password: '', role: 'viewer', areaIds: [], canWrite: false })
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-gray-500" /> Usuários</h1>
        <p className="text-sm text-gray-500 mt-1">Cadastre pessoas e defina acesso por área.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Novo usuário</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">{success}</div>}
          <Field label="Nome"><input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="E-mail"><input required type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Senha inicial"><input required type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></Field>
          <Field label="Perfil"><select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Areas de acesso</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {areas.map((area: any) => <label key={area.id} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2"><input type="checkbox" checked={form.areaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />{area.name}</label>)}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.canWrite} onChange={(e) => setForm((f) => ({ ...f, canWrite: e.target.checked }))} />Pode criar/editar na área</label>
          <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"><Save className="w-4 h-4" />{loading ? 'Salvando...' : 'Criar usuário'}</button>
        </form>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {users.map((u: any) => <div key={u.id} className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email} - {u.role}</p></div>)}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 space-y-1"><span>{label}</span>{children}</label>
}
