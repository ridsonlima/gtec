'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'

export default function MinhaContaPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (newPassword !== confirmPassword) {
      setError('A confirma?o da senha n?o confere.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data?.success === false) {
      setError(data?.error ?? 'Não foi possível alterar a senha.')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setMessage('Senha alterada com sucesso.')
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha conta</h1>
        <p className="text-sm text-gray-500 mt-1">Altere sua senha de acesso.</p>
      </div>
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {message && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">{message}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <label className="block text-sm font-medium text-gray-700 space-y-1"><span>Senha atual</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" required /></label>
        <label className="block text-sm font-medium text-gray-700 space-y-1"><span>Nova senha</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" minLength={6} required /></label>
        <label className="block text-sm font-medium text-gray-700 space-y-1"><span>Confirmar nova senha</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" minLength={6} required /></label>
        <div className="flex justify-end pt-2"><button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"><Save className="w-4 h-4" />{loading ? 'Salvando...' : 'Alterar senha'}</button></div>
      </form>
    </div>
  )
}
