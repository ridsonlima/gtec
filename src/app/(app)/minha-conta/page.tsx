'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Save, User, Shield, MapPin, ClipboardCheck, CheckCircle2, ExternalLink } from 'lucide-react'
import { getRoleLabel } from '@/lib/role-labels'

export default function MinhaContaPage() {
  const { data: session } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  // ── Approvo (configuração individual) ──────────────────────────
  const [apTipo, setApTipo]               = useState('C')
  const [apCodUsuario, setApCodUsuario]   = useState('')
  const [apCodPerfil, setApCodPerfil]     = useState('')
  const [apCodMega, setApCodMega]         = useState('')
  const [apConfigured, setApConfigured]   = useState(false)
  const [apMessage, setApMessage] = useState('')
  const [apError, setApError]     = useState('')
  const [apLoading, setApLoading] = useState(false)

  useEffect(() => {
    fetch('/api/me/approvo')
      .then((r) => r.json())
      .then((res) => {
        const d = res?.data
        if (!d) return
        setApTipo(d.approvoTipoAcesso ?? 'C')
        setApCodUsuario(d.approvoCodUsuario != null ? String(d.approvoCodUsuario) : '')
        setApCodPerfil(d.approvoCodPerfil != null ? String(d.approvoCodPerfil) : '')
        setApCodMega(d.approvoCodUsuarioMega != null ? String(d.approvoCodUsuarioMega) : '')
        setApConfigured(Boolean(d.configurado))
      })
      .catch(() => {})
  }, [])

  async function submitApprovo(e: React.FormEvent) {
    e.preventDefault()
    setApMessage('')
    setApError('')
    setApLoading(true)
    const res = await fetch('/api/me/approvo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvoTipoAcesso: apTipo || 'C',
        approvoCodUsuario: apCodUsuario,
        approvoCodPerfil: apCodPerfil,
        approvoCodUsuarioMega: apCodMega,
      }),
    })
    const data = await res.json()
    setApLoading(false)
    if (!res.ok || data?.success === false) {
      setApError(data?.error ?? 'Não foi possível salvar a configuração do Approvo.')
      return
    }
    setApConfigured(Boolean(data?.data?.configurado))
    setApMessage('Configuração do Approvo salva. Acesse a aba Aprovações para ver a sua fila.')
  }

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

      {/* Configuração do Approvo */}
      <form onSubmit={submitApprovo} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4" />
              Integração Approvo
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Conecte sua conta para ver a sua fila de aprovações na aba <strong>Aprovações</strong>.
              Cada usuário vê apenas a própria fila.
            </p>
          </div>
          {apConfigured ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" /> Configurado
            </span>
          ) : (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full whitespace-nowrap">
              Não configurado
            </span>
          )}
        </div>

        {apMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
            {apMessage}
          </div>
        )}
        {apError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {apError}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs px-3 py-2 rounded-lg leading-relaxed">
          <p className="font-semibold mb-1">Como encontrar os seus códigos</p>
          No Approvo (MegaERP), abra o navegador em <em>Ferramentas do desenvolvedor (F12) → aba Network</em>,
          carregue a sua lista de documentos e localize a chamada <code>ObterCardDocumentos</code>.
          No corpo da requisição estão: <code>codUsuario</code>, <code>codPerfil</code> e <code>codUsuarioMega</code>.
          Em caso de dúvida, peça ao administrador do MegaERP.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-gray-700 space-y-1">
            <span>Código do usuário <span className="text-xs text-gray-400">(codUsuario)</span></span>
            <input
              type="number"
              inputMode="numeric"
              value={apCodUsuario}
              onChange={(e) => setApCodUsuario(e.target.value)}
              className="input"
              placeholder="Ex.: 111"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 space-y-1">
            <span>Código do perfil <span className="text-xs text-gray-400">(codPerfil)</span></span>
            <input
              type="number"
              inputMode="numeric"
              value={apCodPerfil}
              onChange={(e) => setApCodPerfil(e.target.value)}
              className="input"
              placeholder="Ex.: 118"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 space-y-1">
            <span>Código no Mega <span className="text-xs text-gray-400">(codUsuarioMega)</span></span>
            <input
              type="number"
              inputMode="numeric"
              value={apCodMega}
              onChange={(e) => setApCodMega(e.target.value)}
              className="input"
              placeholder="Ex.: 41"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 space-y-1">
            <span>Tipo de acesso <span className="text-xs text-gray-400">(tipoAcesso)</span></span>
            <input
              type="text"
              value={apTipo}
              onChange={(e) => setApTipo(e.target.value)}
              className="input"
              placeholder="C"
              maxLength={2}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <a
            href="https://approvocdg.megaerp.online/Alcada/Alcada.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir Approvo
          </a>
          <button
            disabled={apLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {apLoading ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </form>

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
