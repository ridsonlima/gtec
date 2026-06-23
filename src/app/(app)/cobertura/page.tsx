'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Palmtree, Plus, X, Check, UserCheck, AlertTriangle,
  CalendarDays, ChevronDown, Loader2, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserOption { id: string; name: string; role: string }

interface Aviso {
  id: string
  motivo: string
  dataInicio: string
  dataFim: string | null
  ativo: boolean
  observacoes: string | null
  usuario:    { id: string; name: string; role: string }
  substituto: { id: string; name: string; role: string }
  criadoPor:  { id: string; name: string }
  createdAt:  string
}

const MOTIVO_LABEL: Record<string, string> = {
  ferias:         '🏖️ Férias',
  licenca_medica: '🏥 Licença médica',
  viagem:         '✈️ Viagem a trabalho',
  outro:          '📋 Outro',
}

const ROLE_LABEL: Record<string, string> = {
  master:    'Master',
  admin:     'Admin',
  director:  'Diretor',
  manager:   'Coordenador',
  supervisor:'Supervisor',
  viewer:    'Visualizador',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Formulário de criação ────────────────────────────────────────────────────

function NovoAvisoForm({
  users,
  onSave,
  onCancel,
}: {
  users: UserOption[]
  onSave: () => void
  onCancel: () => void
}) {
  const [usuarioId,    setUsuarioId]    = useState('')
  const [substitutoId, setSubstitutoId] = useState('')
  const [motivo,       setMotivo]       = useState('ferias')
  const [dataInicio,   setDataInicio]   = useState(new Date().toISOString().slice(0, 10))
  const [dataFim,      setDataFim]      = useState('')
  const [observacoes,  setObservacoes]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!usuarioId)    { setError('Selecione o colaborador ausente'); return }
    if (!substitutoId) { setError('Selecione o substituto'); return }
    if (usuarioId === substitutoId) { setError('O substituto deve ser uma pessoa diferente'); return }

    setSaving(true)
    setError('')

    const res = await fetch('/api/ausencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId, substitutoId, motivo, dataInicio,
        dataFim: dataFim || null,
        observacoes: observacoes || null,
      }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { setError(json.error ?? 'Erro ao criar aviso'); return }
    onSave()
  }

  const candidatos = users.filter((u) => u.id !== substitutoId)
  const candidatosSub = users.filter((u) => u.id !== usuarioId)

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Palmtree className="w-4 h-4 text-yellow-500" />
        Novo aviso de ausência
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Colaborador ausente */}
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Colaborador ausente *</span>
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            required
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Selecionar pessoa…</option>
            {candidatos.map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role] ?? u.role}</option>
            ))}
          </select>
        </label>

        {/* Substituto */}
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Substituto(a) *</span>
          <select
            value={substitutoId}
            onChange={(e) => setSubstitutoId(e.target.value)}
            required
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Selecionar substituto…</option>
            {candidatosSub.map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role] ?? u.role}</option>
            ))}
          </select>
        </label>

        {/* Motivo */}
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Motivo</span>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {Object.entries(MOTIVO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        {/* Início */}
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Início *</span>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>

        {/* Retorno previsto */}
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Retorno previsto <span className="text-gray-400">(opcional)</span></span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            min={dataInicio}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
      </div>

      {/* Observações */}
      <label className="block text-xs font-medium text-gray-600 space-y-1">
        <span>Observações</span>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          placeholder="Informações adicionais para o substituto…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
        />
      </label>

      {/* Aviso informativo */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          O substituto passará a visualizar e gerenciar as demandas do colaborador ausente.
          As atribuições originais <strong>não são alteradas</strong> — tudo retorna automaticamente ao encerrar o aviso.
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palmtree className="w-4 h-4" />}
          {saving ? 'Criando…' : 'Anunciar ausência'}
        </button>
      </div>
    </form>
  )
}

// ─── Card de aviso ────────────────────────────────────────────────────────────

function AvisoCard({
  aviso,
  onEncerrar,
  onEdit,
}: {
  aviso: Aviso
  onEncerrar: (id: string) => void
  onEdit: (aviso: Aviso) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)

  async function handleEncerrar() {
    setLoading(true)
    await onEncerrar(aviso.id)
    setLoading(false)
    setConfirming(false)
  }

  const isAtivo   = aviso.ativo
  const overdue   = aviso.dataFim && new Date(aviso.dataFim) < new Date() && isAtivo

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      isAtivo
        ? overdue ? 'border-red-200 bg-red-50/30' : 'border-yellow-200 bg-yellow-50/20'
        : 'border-gray-100 bg-gray-50/50 opacity-60',
    )}>
      <div className="flex items-start gap-3 flex-wrap">
        {/* Ícone motivo */}
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg',
          isAtivo ? 'bg-yellow-100' : 'bg-gray-100',
        )}>
          {aviso.motivo === 'ferias' ? '🏖️' : aviso.motivo === 'licenca_medica' ? '🏥' : aviso.motivo === 'viagem' ? '✈️' : '📋'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{aviso.usuario.name}</span>
            <span className="text-xs text-gray-400">→</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> coberto por
            </span>
            <span className="text-sm font-semibold text-blue-700">{aviso.substituto.name}</span>

            {/* Status badges */}
            {isAtivo && !overdue && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                ativo
              </span>
            )}
            {overdue && isAtivo && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> retorno vencido
              </span>
            )}
            {!isAtivo && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                encerrado
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {fmtDate(aviso.dataInicio)}
              {aviso.dataFim ? ` → ${fmtDate(aviso.dataFim)}` : ' → sem data de retorno'}
            </span>
            <span>• {MOTIVO_LABEL[aviso.motivo] ?? aviso.motivo}</span>
            <span>• anunciado por {aviso.criadoPor.name}</span>
          </div>

          {aviso.observacoes && (
            <p className="mt-1.5 text-xs text-gray-500 italic">"{aviso.observacoes}"</p>
          )}
        </div>

        {/* Ações */}
        {isAtivo && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Confirmar encerramento?</span>
                <button
                  onClick={handleEncerrar}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Sim, encerrar
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onEdit(aviso)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Encerrar retorno
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  aviso,
  users,
  onSave,
  onClose,
}: {
  aviso: Aviso
  users: UserOption[]
  onSave: () => void
  onClose: () => void
}) {
  const [substitutoId, setSubstitutoId] = useState(aviso.substituto.id)
  const [dataFim,      setDataFim]      = useState(
    aviso.dataFim ? new Date(aviso.dataFim).toISOString().slice(0, 10) : ''
  )
  const [observacoes,  setObservacoes]  = useState(aviso.observacoes ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/ausencias/${aviso.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        substitutoId,
        dataFim: dataFim || null,
        observacoes: observacoes || null,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Erro ao salvar'); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Editar aviso — {aviso.usuario.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Substituto(a)</span>
          <select
            value={substitutoId}
            onChange={(e) => setSubstitutoId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {users.filter((u) => u.id !== aviso.usuario.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role] ?? u.role}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Data de retorno</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>

        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Observações</span>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoberturaPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]     = useState(false)
  const [editAviso, setEditAviso]   = useState<Aviso | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const { data: avisosData, isLoading } = useQuery({
    queryKey: ['ausencias', showHistory],
    queryFn:  () =>
      fetch(`/api/ausencias${showHistory ? '?todas=true' : ''}`).then((r) => r.json()),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-list-team'],
    queryFn:  () => fetch('/api/users?team=true').then((r) => r.json()),
  })

  const avisos: Aviso[]       = avisosData?.data ?? []
  const users: UserOption[]   = usersData?.data ?? []

  const ativos     = avisos.filter((a) => a.ativo)
  const encerrados = avisos.filter((a) => !a.ativo)

  function refresh() {
    qc.invalidateQueries({ queryKey: ['ausencias'] })
    qc.invalidateQueries({ queryKey: ['ausencia-me'] })
  }

  async function handleEncerrar(id: string) {
    await fetch(`/api/ausencias/${id}`, { method: 'DELETE' })
    refresh()
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-yellow-500" />
            Cobertura de Férias
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Anuncie ausências e defina quem cobre as demandas de cada colaborador.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-xl shadow-sm"
        >
          <Plus className="w-4 h-4" /> Anunciar ausência
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <NovoAvisoForm
          users={users}
          onSave={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Como funciona */}
      {ativos.length === 0 && !isLoading && !showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4" /> Como funciona
          </p>
          <ul className="text-sm text-amber-700 space-y-1.5 pl-1">
            <li>• Ao anunciar uma ausência, o <strong>substituto indicado</strong> passa a enxergar e gerenciar todas as demandas do colaborador ausente.</li>
            <li>• As atribuições originais <strong>não são alteradas</strong> no banco de dados — apenas a visibilidade e permissões são expandidas.</li>
            <li>• O substituto vê um <strong>banner azul</strong> em todas as telas avisando que está em modo de cobertura.</li>
            <li>• O colaborador ausente vê um <strong>banner amarelo</strong> indicando quem está cobrindo.</li>
            <li>• Ao clicar em <strong>"Encerrar retorno"</strong>, tudo volta ao normal instantaneamente.</li>
          </ul>
        </div>
      )}

      {/* Ausências ativas */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 justify-center py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {ativos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ausências ativas ({ativos.length})
              </h2>
              {ativos.map((a) => (
                <AvisoCard
                  key={a.id}
                  aviso={a}
                  onEncerrar={handleEncerrar}
                  onEdit={setEditAviso}
                />
              ))}
            </section>
          )}

          {/* Histórico */}
          {encerrados.length > 0 || showHistory ? (
            <section className="space-y-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showHistory && 'rotate-180')} />
                Histórico ({encerrados.length})
              </button>
              {showHistory && encerrados.map((a) => (
                <AvisoCard
                  key={a.id}
                  aviso={a}
                  onEncerrar={handleEncerrar}
                  onEdit={setEditAviso}
                />
              ))}
            </section>
          ) : null}
        </>
      )}

      {/* Modal edição */}
      {editAviso && (
        <EditModal
          aviso={editAviso}
          users={users}
          onSave={() => { setEditAviso(null); refresh() }}
          onClose={() => setEditAviso(null)}
        />
      )}
    </div>
  )
}
