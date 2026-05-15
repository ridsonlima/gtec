'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Save, User, Shield, MapPin } from 'lucide-react'
import { getRoleLabel } from '@/lib/role-labels'

export default function MinhaContaPage() {
  const { data: session } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não confere.')
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

  const user = session?.user

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Minha Conta</h1>
        <p className="text-sm text-gray-500 mt-0.5">Perfil e configurações da sua conta</p>
      </div>

      {/* Cartão de perfil */}
      {user && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <User className="w-4 h-4" />
            Informações do perfil
          </h2>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-semibold">
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Papel</p>
                <p className="text-sm font-medium text-gray-700">{getRoleLabel(user.role)}</p>
              </div>
            </div>

            {user.areaScopes && user.areaScopes.length > 0 && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">
                    {user.areaScopes.length === 1 ? 'Área' : 'Áreas'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {user.areaScopes.map((s) => (
                      <span
                        key={s.areaId}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.canWrite
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {s.areaName}
                        {!s.canWrite && ' (leitura)'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Troca de senha */}
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Alterar senha</h2>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 space-y-1">
          <span>Senha atual</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
            required
          />
        </label>
        <label className="block text-sm font-medium text-gray-700 space-y-1">
          <span>Nova senha</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
            minLength={6}
            required
          />
        </label>
        <label className="block text-sm font-medium text-gray-700 space-y-1">
          <span>Confirmar nova senha</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            minLength={6}
            required
          />
        </label>
        <div className="flex justify-end pt-2">
          <button
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  )
}
