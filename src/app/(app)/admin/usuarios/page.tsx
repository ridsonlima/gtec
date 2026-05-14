'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Edit2, Save, Trash2, Users, X } from 'lucide-react'

const ROLES = [
  { value: 'master', label: 'Master' },
  { value: 'admin', label: 'Administrador' },
  { value: 'director', label: 'Diretor' },
  { value: 'manager', label: 'Coordenador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'viewer', label: 'Visualizador' },
]

type UserForm = {
  name: string
  email: string
  password: string
  role: string
  areaIds: string[]
  canWrite: boolean
}

const emptyForm: UserForm = { name: '', email: '', password: '', role: 'viewer', areaIds: [], canWrite: false }

export default function UsersAdminPage() {
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editForm, setEditForm] = useState<UserForm>(emptyForm)

  const { data: usersData } = useQuery({ queryKey: ['admin-users'], queryFn: () => fetch('/api/users').then((r) => r.json()) })
  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const users = usersData?.data ?? []
  const areas = areasData?.data ?? []

  function roleLabel(role: string) {
    return ROLES.find((item) => item.value === role)?.label ?? role
  }

  function toggleArea(areaId: string) {
    setForm((f) => ({ ...f, areaIds: f.areaIds.includes(areaId) ? f.areaIds.filter((id) => id !== areaId) : [...f.areaIds, areaId] }))
  }

  function toggleEditArea(areaId: string) {
    setEditForm((f) => ({ ...f, areaIds: f.areaIds.includes(areaId) ? f.areaIds.filter((id) => id !== areaId) : [...f.areaIds, areaId] }))
  }

  function startEdit(user: any) {
    const scopes = user.areaScopes ?? []
    setError('')
    setSuccess('')
    setEditingUser(user)
    setEditForm({
      name: user.name ?? '',
      email: user.email ?? '',
      password: '',
      role: user.role ?? 'viewer',
      areaIds: scopes.map((scope: any) => scope.areaId),
      canWrite: scopes.some((scope: any) => scope.canWrite),
    })
  }

  function cancelEdit() {
    setEditingUser(null)
    setEditForm(emptyForm)
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
    setSuccess('Usuário criado com sucesso')
    setForm(emptyForm)
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return

    setLoading(true)
    setError('')
    setSuccess('')
    const payload = { ...editForm, password: editForm.password.trim() ? editForm.password : undefined }
    const res = await fetch(`/api/users/${editingUser.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data?.success === false) {
      setError(data?.error ?? 'Não foi possível salvar o usuário')
      return
    }
    setSuccess('Usuário atualizado com sucesso')
    cancelEdit()
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  async function deleteUser(user: any) {
    const ok = window.confirm(`Excluir o acesso de ${user.name}? O histórico criado por este usuário será mantido.`)
    if (!ok) return

    setDeletingId(user.id)
    setError('')
    setSuccess('')
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeletingId('')
    if (!res.ok || data?.success === false) {
      setError(data?.error ?? 'Não foi possível excluir o usuário')
      return
    }
    if (editingUser?.id === user.id) cancelEdit()
    setSuccess('Usuário excluído com sucesso')
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-gray-500" /> Usuários</h1>
        <p className="text-sm text-gray-500 mt-1">Cadastre pessoas, edite perfis e defina acesso por área.</p>
      </div>

      {(error || success) && (
        <div className={error ? 'bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg' : 'bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg'}>
          {error || success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Novo usuário</h2>
          <UserFields form={form} setForm={setForm} areas={areas} toggleArea={toggleArea} passwordLabel="Senha inicial" passwordRequired />
          <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
            <Save className="w-4 h-4" />{loading ? 'Salvando...' : 'Criar usuário'}
          </button>
        </form>

        <div className="space-y-5">
          {editingUser && (
            <form onSubmit={submitEdit} className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Editar usuário</h2>
                <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><X className="w-4 h-4" />Cancelar</button>
              </div>
              <UserFields form={editForm} setForm={setEditForm} areas={areas} toggleArea={toggleEditArea} passwordLabel="Nova senha" passwordHint="Preencha somente se quiser trocar a senha." />
              <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                <Save className="w-4 h-4" />{loading ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {users.length === 0 && <p className="px-4 py-5 text-sm text-gray-500">Nenhum usuário cadastrado.</p>}
            {users.map((u: any) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email} - {roleLabel(u.role)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(u)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Edit2 className="w-3.5 h-3.5" />Editar
                  </button>
                  <button type="button" disabled={deletingId === u.id} onClick={() => deleteUser(u)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-60">
                    <Trash2 className="w-3.5 h-3.5" />{deletingId === u.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserFields({ form, setForm, areas, toggleArea, passwordLabel, passwordRequired = false, passwordHint }: { form: UserForm; setForm: React.Dispatch<React.SetStateAction<UserForm>>; areas: any[]; toggleArea: (areaId: string) => void; passwordLabel: string; passwordRequired?: boolean; passwordHint?: string }) {
  return (
    <>
      <Field label="Nome"><input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="E-mail"><input required type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
      <Field label={passwordLabel}>
        <input required={passwordRequired} type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        {passwordHint && <span className="block text-xs font-normal text-gray-500">{passwordHint}</span>}
      </Field>
      <Field label="Perfil"><select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Áreas de acesso</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {areas.map((area: any) => <label key={area.id} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2"><input type="checkbox" checked={form.areaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />{area.name}</label>)}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.canWrite} onChange={(e) => setForm((f) => ({ ...f, canWrite: e.target.checked }))} />Pode criar/editar na área</label>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 space-y-1"><span>{label}</span>{children}</label>
}
