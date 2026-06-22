'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Edit2, Save, Trash2, Users, X, Clock, LogIn } from 'lucide-react'
import { ASSIGNABLE_ROLES, getRoleLabel } from '@/lib/role-labels'

function tempoRelativo(dataISO: string | null | undefined): string {
  if (!dataISO) return 'Nunca acessou'
  const diff = Date.now() - new Date(dataISO).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)
  const sem  = Math.floor(d / 7)
  const mes  = Math.floor(d / 30)
  if (min < 1)   return 'Agora mesmo'
  if (min < 60)  return `Há ${min} min`
  if (h < 24)    return `Há ${h}h`
  if (d < 7)     return `Há ${d} dia${d > 1 ? 's' : ''}`
  if (sem < 4)   return `Há ${sem} semana${sem > 1 ? 's' : ''}`
  return `Há ${mes} mês${mes > 1 ? 'es' : ''}`
}

const ROLES = ASSIGNABLE_ROLES

type UserForm = {
  name: string
  email: string
  password: string
  role: string
  areaIds: string[]
  canWrite: boolean
  approvoCodUsuario: string
  approvoCodPerfil: string
  approvoCodUsuarioMega: string
}

const emptyForm: UserForm = { name: '', email: '', password: '', role: 'viewer', areaIds: [], canWrite: false, approvoCodUsuario: '', approvoCodPerfil: '', approvoCodUsuarioMega: '' }

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
  const { data: areasData } = useQuery({ queryKey: ['areas-leaf'], queryFn: () => fetch('/api/areas?leafOnly=true').then((r) => r.json()) })
  const users = usersData?.data ?? []
  const areas = areasData?.data ?? []

  function roleLabel(role: string) {
    return getRoleLabel(role)
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
      approvoCodUsuario: user.approvoCodUsuario != null ? String(user.approvoCodUsuario) : '',
      approvoCodPerfil: user.approvoCodPerfil != null ? String(user.approvoCodPerfil) : '',
      approvoCodUsuarioMega: user.approvoCodUsuarioMega != null ? String(user.approvoCodUsuarioMega) : '',
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
            {users.map((u: any) => {
              const nunca = !u.lastLoginAt
              return (
                <div key={u.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      {!u.isActive && (
                        <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">Inativo</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{u.email} · {roleLabel(u.role)}</p>

                    {/* Último login + contador */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${nunca ? 'text-gray-400 bg-gray-50 border-gray-200' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>
                        <Clock className="w-3 h-3" />
                        {tempoRelativo(u.lastLoginAt)}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${u.loginCount === 0 ? 'text-gray-400 bg-gray-50 border-gray-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                        <LogIn className="w-3 h-3" />
                        {u.loginCount ?? 0} acesso{u.loginCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => startEdit(u)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Edit2 className="w-3.5 h-3.5" />Editar
                    </button>
                    <button type="button" disabled={deletingId === u.id} onClick={() => deleteUser(u)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-60">
                      <Trash2 className="w-3.5 h-3.5" />{deletingId === u.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              )
            })}
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

      {/* Integração Approvo — códigos do usuário (para ver só a própria fila) */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-sm font-medium text-gray-700">Integração Approvo</p>
        <p className="text-xs text-gray-400 mb-2">Códigos do Approvo deste usuário (DevTools → ObterCardDocumentos → Payload). Deixe em branco se o usuário não usa o Approvo.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="codUsuario"><input type="number" className="input" value={form.approvoCodUsuario} onChange={(e) => setForm((f) => ({ ...f, approvoCodUsuario: e.target.value }))} /></Field>
          <Field label="codPerfil"><input type="number" className="input" value={form.approvoCodPerfil} onChange={(e) => setForm((f) => ({ ...f, approvoCodPerfil: e.target.value }))} /></Field>
          <Field label="codUsuarioMega"><input type="number" className="input" value={form.approvoCodUsuarioMega} onChange={(e) => setForm((f) => ({ ...f, approvoCodUsuarioMega: e.target.value }))} /></Field>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 space-y-1"><span>{label}</span>{children}</label>
}
