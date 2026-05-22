'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Check, Clock, AlertTriangle, Pencil, Trash2,
  ChevronDown, Circle, Loader2, Flag,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status     = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  status: string
  prioridade: string
  categoria: string | null
  prazo: string | null
  concluidaEm: string | null
  createdAt: string
  updatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  pendente:     { label: 'Pendente',     cls: 'bg-gray-100 text-gray-600 border-gray-200',   dot: 'bg-gray-400'  },
  em_andamento: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500'  },
  concluida:    { label: 'Concluída',    cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  cancelada:    { label: 'Cancelada',    cls: 'bg-red-50 text-red-600 border-red-200',       dot: 'bg-red-400'   },
}

const PRIO_META: Record<Prioridade, { label: string; cls: string; dot: string }> = {
  baixa:   { label: 'Baixa',   cls: 'text-gray-500',   dot: 'bg-gray-400'   },
  media:   { label: 'Média',   cls: 'text-blue-600',   dot: 'bg-blue-400'   },
  alta:    { label: 'Alta',    cls: 'text-orange-600', dot: 'bg-orange-400' },
  urgente: { label: 'Urgente', cls: 'text-red-600',    dot: 'bg-red-500'    },
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null

const isOverdue = (t: Tarefa) =>
  t.prazo && !['concluida', 'cancelada'].includes(t.status) && new Date(t.prazo) < new Date()

// ─── Nova / Edição de tarefa form ─────────────────────────────────────────────

function TarefaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Tarefa>
  onSave: (data: Partial<Tarefa>) => Promise<void>
  onCancel: () => void
}) {
  const [titulo, setTitulo]         = useState(initial?.titulo ?? '')
  const [descricao, setDescricao]   = useState(initial?.descricao ?? '')
  const [prioridade, setPrioridade] = useState<Prioridade>((initial?.prioridade as Prioridade) ?? 'media')
  const [categoria, setCategoria]   = useState(initial?.categoria ?? '')
  const [prazo, setPrazo]           = useState(
    initial?.prazo ? new Date(initial.prazo).toISOString().slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) { setError('Título obrigatório'); return }
    setError('')
    setSaving(true)
    try {
      await onSave({ titulo, descricao: descricao || null, prioridade, categoria: categoria || null, prazo: prazo || null })
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 p-4 space-y-3">
      <input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título da tarefa*"
        className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Prioridade */}
        <label className="block text-xs font-medium text-gray-500 space-y-1">
          <span>Prioridade</span>
          <select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {(Object.keys(PRIO_META) as Prioridade[]).map((p) => (
              <option key={p} value={p}>{PRIO_META[p].label}</option>
            ))}
          </select>
        </label>
        {/* Prazo */}
        <label className="block text-xs font-medium text-gray-500 space-y-1">
          <span>Prazo</span>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        {/* Categoria */}
        <label className="block text-xs font-medium text-gray-500 space-y-1 col-span-2 sm:col-span-1">
          <span>Categoria</span>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Reunião, Relatório..."
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ─── Tarefa card ──────────────────────────────────────────────────────────────

function TarefaCard({
  tarefa,
  onUpdate,
  onDelete,
}: {
  tarefa: Tarefa
  onUpdate: (id: string, data: Partial<Tarefa>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const statusMeta = STATUS_META[tarefa.status as Status] ?? STATUS_META.pendente
  const prioMeta   = PRIO_META[tarefa.prioridade as Prioridade] ?? PRIO_META.media
  const overdue    = isOverdue(tarefa)
  const done       = tarefa.status === 'concluida'
  const cancelled  = tarefa.status === 'cancelada'

  async function toggleComplete() {
    setToggling(true)
    const newStatus = done ? 'pendente' : 'concluida'
    await onUpdate(tarefa.id, { status: newStatus })
    setToggling(false)
  }

  async function handleDelete() {
    if (!confirm('Excluir esta tarefa?')) return
    setDeleting(true)
    await onDelete(tarefa.id)
    setDeleting(false)
  }

  if (editing) {
    return (
      <TarefaForm
        initial={tarefa}
        onSave={async (data) => { await onUpdate(tarefa.id, data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className={`bg-white rounded-xl border p-3.5 flex gap-3 transition-all group ${overdue ? 'border-red-200' : 'border-gray-200'} ${(done || cancelled) ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={toggleComplete}
        disabled={toggling || cancelled}
        className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
          ${done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
      >
        {toggling ? <Loader2 className="w-3 h-3 animate-spin text-gray-400" /> : done ? <Check className="w-3 h-3" /> : null}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug ${done || cancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {tarefa.titulo}
          </p>
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} disabled={deleting} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {tarefa.descricao && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{tarefa.descricao}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {statusOpen && (
              <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                {(Object.keys(STATUS_META) as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={async () => { setStatusOpen(false); await onUpdate(tarefa.id, { status: s }) }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left ${tarefa.status === s ? 'font-semibold' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prioridade */}
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${prioMeta.cls}`}>
            <Flag className="w-3 h-3" />
            {prioMeta.label}
          </span>

          {/* Categoria */}
          {tarefa.categoria && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{tarefa.categoria}</span>
          )}

          {/* Prazo */}
          {tarefa.prazo && (
            <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {fmt(tarefa.prazo)}
            </span>
          )}

          {/* Concluída em */}
          {done && tarefa.concluidaEm && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> {fmt(tarefa.concluidaEm)}
            </span>
          )}
        </div>
      </div>

      {/* Click outside to close status dropdown */}
      {statusOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setStatusOpen(false)} />
      )}
    </div>
  )
}

// ─── Main Board Component ─────────────────────────────────────────────────────

export function TarefasBoard({ initialTarefas }: { initialTarefas: Tarefa[] }) {
  const router = useRouter()
  const [tarefas, setTarefas]         = useState<Tarefa[]>(initialTarefas)
  const [showForm, setShowForm]       = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('ativas')
  const [filterPrio, setFilterPrio]   = useState<string>('')
  const [search, setSearch]           = useState('')
  const [_pending, startTransition]   = useTransition()

  function refresh() { startTransition(() => router.refresh()) }

  // ── CRUD helpers ──────────────────────────────────────────────────────────

  async function createTarefa(data: Partial<Tarefa>) {
    const res = await fetch('/api/tarefas-pessoais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro')
    setTarefas((prev) => [json.data, ...prev])
    setShowForm(false)
    refresh()
  }

  async function updateTarefa(id: string, data: Partial<Tarefa>) {
    const res = await fetch(`/api/tarefas-pessoais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro')
    setTarefas((prev) => prev.map((t) => (t.id === id ? json.data : t)))
    refresh()
  }

  async function deleteTarefa(id: string) {
    const res = await fetch(`/api/tarefas-pessoais/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Erro ao excluir')
    setTarefas((prev) => prev.filter((t) => t.id !== id))
    refresh()
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = tarefas.filter((t) => {
    if (filterStatus === 'ativas' && ['concluida', 'cancelada'].includes(t.status)) return false
    if (filterStatus === 'concluidas' && t.status !== 'concluida') return false
    if (filterStatus === 'canceladas' && t.status !== 'cancelada') return false
    if (filterStatus === 'vencidas' && !isOverdue(t)) return false
    if (filterPrio && t.prioridade !== filterPrio) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.titulo.toLowerCase().includes(q) && !(t.descricao ?? '').toLowerCase().includes(q) && !(t.categoria ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Counts
  const totalAtivas   = tarefas.filter((t) => !['concluida', 'cancelada'].includes(t.status)).length
  const totalVencidas = tarefas.filter((t) => isOverdue(t)).length
  const totalConcl    = tarefas.filter((t) => t.status === 'concluida').length

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Em aberto',  value: totalAtivas,   cls: totalAtivas   ? 'text-gray-900'   : 'text-gray-300' },
          { label: 'Vencidas',   value: totalVencidas, cls: totalVencidas ? 'text-red-600'    : 'text-gray-300' },
          { label: 'Concluídas', value: totalConcl,    cls: totalConcl    ? 'text-green-600'  : 'text-gray-300' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-400">{k.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tarefa..."
          className="flex-1 min-w-[180px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {/* Nova tarefa button */}
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {/* Nova tarefa form */}
      {showForm && (
        <TarefaForm onSave={createTarefa} onCancel={() => setShowForm(false)} />
      )}

      {/* Filtros status */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'ativas',    label: `Ativas (${totalAtivas})` },
          { key: 'vencidas',  label: `Vencidas (${totalVencidas})` },
          { key: 'concluidas',label: `Concluídas (${totalConcl})` },
          { key: 'canceladas',label: 'Canceladas' },
          { key: '',          label: 'Todas' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${filterStatus === key ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtro prioridade */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilterPrio('')} className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${!filterPrio ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
          Todas prioridades
        </button>
        {(Object.keys(PRIO_META) as Prioridade[]).map((p) => (
          <button
            key={p}
            onClick={() => setFilterPrio(filterPrio === p ? '' : p)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${filterPrio === p ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            <span className={`w-2 h-2 rounded-full ${PRIO_META[p].dot}`} />
            {PRIO_META[p].label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Circle className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {search || filterStatus || filterPrio ? 'Nenhuma tarefa encontrada com esses filtros' : 'Nenhuma tarefa ainda — crie a primeira!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TarefaCard
              key={t.id}
              tarefa={t}
              onUpdate={updateTarefa}
              onDelete={deleteTarefa}
            />
          ))}
        </div>
      )}
    </div>
  )
}
