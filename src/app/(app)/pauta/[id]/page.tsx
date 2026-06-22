'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ChevronLeft, Calendar, Clock, CheckCircle2, Circle, ExternalLink,
  AlertCircle, ArrowRight, Plus, MessageSquare, ChevronDown, ChevronUp,
  TrendingUp, BarChart2, Footprints, CalendarClock, Pencil, Save, X,
  Users, Building2, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const ORIGIN_LABELS: Record<string, string> = {
  director:  'Diretoria',
  area:      'Área',
  report:    'Report',
  demand:    'Demanda',
  contract:  'Contrato',
  recurring: 'Recorrente',
  manual:    'Manual',
  other:     'Outro',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', scheduled: 'Agendada', done: 'Realizada',
  cancelled: 'Cancelada', preparing: 'Preparando', finalized: 'Finalizada', held: 'Realizada',
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-500 bg-gray-100', scheduled: 'text-blue-700 bg-blue-50',
  done: 'text-green-700 bg-green-50', held: 'text-green-700 bg-green-50',
  cancelled: 'text-red-600 bg-red-50', preparing: 'text-amber-700 bg-amber-50',
  finalized: 'text-purple-700 bg-purple-50',
}
const ITEM_STATUS_COLORS: Record<string, string> = {
  pending:   'border-gray-200 bg-white',
  discussed: 'border-blue-200 bg-blue-50/30',
  done:      'border-green-200 bg-green-50/30',
  deferred:  'border-amber-200 bg-amber-50/30',
}
const TIPO_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  diretoria: { label: 'Com Diretoria', icon: <Users className="w-3 h-3" />,    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  interarea: { label: 'Interárea',     icon: <Building2 className="w-3 h-3" />, cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  externo:   { label: 'Externo',       icon: <Globe className="w-3 h-3" />,     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
}

function formatDateTime(dt: string | null) {
  if (!dt) return null
  return new Date(dt).toLocaleString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function formatDate(dt: string | null) {
  if (!dt) return null
  return new Date(dt).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Inline editable text section ────────────────────────────────────────────

function EditableSection({
  label,
  icon,
  value,
  placeholder,
  onSave,
  rows = 3,
  type = 'textarea',
}: {
  label: string
  icon: React.ReactNode
  value: string | null
  placeholder: string
  onSave: (v: string) => Promise<void>
  rows?: number
  type?: 'textarea' | 'datetime-local'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(value ?? '')
    setEditing(false)
  }

  const displayValue = type === 'datetime-local' && value
    ? formatDate(value)
    : value

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          {icon} {label}
        </h3>
        {!editing && (
          <button
            onClick={() => { setDraft(type === 'datetime-local' && value ? new Date(value).toISOString().slice(0, 16) : (value ?? '')); setEditing(true) }}
            className="text-gray-300 hover:text-blue-500 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {type === 'textarea' ? (
            <textarea
              autoFocus
              rows={rows}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          ) : (
            <input
              autoFocus
              type="datetime-local"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={handleCancel} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
              <X className="w-3 h-3" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : displayValue ? (
        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{displayValue}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">{placeholder}</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendaDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['agenda', params.id],
    queryFn: () => fetch(`/api/agenda/${params.id}`).then((r) => r.json()),
  })

  const patchItemMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/agenda/${params.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', params.id] }),
  })

  const patchAgendaMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/agenda/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', params.id] }),
  })

  // Adicionar novo tema/item à pauta
  const [addingItem, setAddingItem]   = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemDesc, setNewItemDesc]   = useState('')

  const createItemMutation = useMutation({
    mutationFn: async (payload: { title: string; description: string | null }) => {
      const res = await fetch(`/api/agenda/${params.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao adicionar tema')
      return json
    },
    onSuccess: () => {
      setNewItemTitle('')
      setNewItemDesc('')
      setAddingItem(false)
      qc.invalidateQueries({ queryKey: ['agenda', params.id] })
    },
  })

  // Edição e exclusão da reunião
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editObjective, setEditObjective] = useState('')
  const [editTipo, setEditTipo] = useState('diretoria')
  const [editScheduledAt, setEditScheduledAt] = useState('')

  const deleteAgendaMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agenda/${params.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao excluir')
      return json
    },
    onSuccess: () => router.push('/pauta'),
  })

  function toLocalInput(iso?: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  function openEdit(ag: any) {
    setEditTitle(ag.title ?? '')
    setEditObjective(ag.objective ?? '')
    setEditTipo(ag.tipo ?? 'diretoria')
    setEditScheduledAt(toLocalInput(ag.scheduledAt))
    setEditing(true)
  }

  async function saveEdit() {
    await patchAgendaMutation.mutateAsync({
      title: editTitle,
      objective: editObjective || null,
      tipo: editTipo,
      scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
    })
    setEditing(false)
  }

  const agenda = data?.data
  const items: any[] = agenda?.items ?? []
  const done     = items.filter((i) => i.status === 'done' || i.status === 'discussed').length
  const total    = items.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        Carregando pauta...
      </div>
    )
  }

  if (!agenda) return <p className="text-sm text-gray-400 py-12 text-center">Pauta não encontrada.</p>

  const totalMinutes = items.reduce((acc: number, i: any) => acc + (i.estimatedMinutes ?? 0), 0)
  const tipoMeta = TIPO_META[agenda.tipo ?? 'diretoria'] ?? TIPO_META.diretoria

  async function saveField(field: string, value: string) {
    await patchAgendaMutation.mutateAsync({ [field]: value || null })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/pauta" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" /> Pautas
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[agenda.status] ?? 'bg-gray-100 text-gray-500')}>
                {STATUS_LABELS[agenda.status] ?? agenda.status}
              </span>
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', tipoMeta.cls)}>
                {tipoMeta.icon} {tipoMeta.label}
              </span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{agenda.title}</h1>
            {agenda.objective && (
              <p className="text-sm text-gray-500 mt-1">{agenda.objective}</p>
            )}

            {/* Participantes externos */}
            {agenda.participantesExternos && (
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 mt-2 inline-block">
                🌐 {agenda.participantesExternos}
              </p>
            )}

            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
              {agenda.scheduledAt && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDateTime(agenda.scheduledAt)}</span>
              )}
              {totalMinutes > 0 && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{totalMinutes} min estimados</span>
              )}
              <span>{total} item{total !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Ações: editar / excluir */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => openEdit(agenda)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
            >
              <X className="w-3.5 h-3.5" /> Excluir
            </button>
          </div>
        </div>

        {/* Confirmação de exclusão */}
        {confirmDelete && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-red-800">Excluir esta reunião e todos os seus itens? Esta ação é irreversível.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg">Cancelar</button>
              <button
                onClick={() => deleteAgendaMutation.mutate()}
                disabled={deleteAgendaMutation.isPending}
                className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteAgendaMutation.isPending ? 'Excluindo…' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        )}

        {/* Painel de edição */}
        {editing && (
          <div className="mt-4 border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
              <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objetivo</label>
              <textarea className="input min-h-20" value={editObjective} onChange={(e) => setEditObjective(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select className="input" value={editTipo} onChange={(e) => setEditTipo(e.target.value)}>
                  <option value="diretoria">Diretoria</option>
                  <option value="interarea">Interárea</option>
                  <option value="externo">Externo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data e hora</label>
                <input type="datetime-local" className="input" value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button
                onClick={saveEdit}
                disabled={patchAgendaMutation.isPending || !editTitle.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {patchAgendaMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Barra de progresso */}
        {total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{done} de {total} itens tratados</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={cn('h-2 rounded-full transition-all', progress === 100 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Itens da pauta */}
      <div className="space-y-2">
        {items.map((item: any, idx: number) => (
          <AgendaItemCard
            key={item.id}
            item={item}
            index={idx + 1}
            agendaId={params.id}
            expanded={expandedItem === item.id}
            onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            onUpdate={(payload) => patchItemMutation.mutate({ itemId: item.id, ...payload })}
            isPending={patchItemMutation.isPending}
            router={router}
          />
        ))}

        {items.length === 0 && !addingItem && (
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhum tema na pauta ainda. Adicione o primeiro abaixo.
          </p>
        )}

        {/* Adicionar novo tema */}
        {addingItem ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Novo tema</p>
            <input
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="Título do tema (ex.: Andamento do contrato X)"
              autoFocus
              className="w-full text-sm font-medium border border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newItemTitle.trim()) {
                  createItemMutation.mutate({ title: newItemTitle.trim(), description: newItemDesc.trim() || null })
                }
              }}
            />
            <textarea
              value={newItemDesc}
              onChange={(e) => setNewItemDesc(e.target.value)}
              rows={2}
              placeholder="Descrição / contexto (opcional)"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => createItemMutation.mutate({ title: newItemTitle.trim(), description: newItemDesc.trim() || null })}
                disabled={createItemMutation.isPending || !newItemTitle.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {createItemMutation.isPending ? 'Adicionando…' : 'Adicionar tema'}
              </button>
              <button
                onClick={() => { setAddingItem(false); setNewItemTitle(''); setNewItemDesc('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingItem(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar tema à pauta
          </button>
        )}
      </div>

      {/* ═══ Seções de acompanhamento ═══ */}
      <div className="pt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Registro da Reunião</p>
      </div>

      {/* Evoluções */}
      <EditableSection
        label="Evoluções"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        value={agenda.evolucoes}
        placeholder="Registre o que evoluiu desde a última reunião..."
        rows={4}
        onSave={(v) => saveField('evolucoes', v)}
      />

      {/* Situação */}
      <EditableSection
        label="Situação Atual"
        icon={<BarChart2 className="w-3.5 h-3.5" />}
        value={agenda.situacao}
        placeholder="Descreva a situação atual dos temas tratados..."
        rows={3}
        onSave={(v) => saveField('situacao', v)}
      />

      {/* Próximos passos */}
      <EditableSection
        label="Próximos Passos"
        icon={<Footprints className="w-3.5 h-3.5" />}
        value={agenda.proximosPassos}
        placeholder="Liste os encaminhamentos e ações a serem tomadas..."
        rows={4}
        onSave={(v) => saveField('proximosPassos', v)}
      />

      {/* Próxima reunião */}
      <EditableSection
        label="Próxima Reunião"
        icon={<CalendarClock className="w-3.5 h-3.5" />}
        value={agenda.proximaReuniao}
        placeholder="Clique em editar para definir a data da próxima reunião"
        type="datetime-local"
        onSave={(v) => saveField('proximaReuniao', v)}
      />

      {/* Ata */}
      {agenda.minutesText && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ata da Reunião</h2>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{agenda.minutesText}</div>
        </div>
      )}
    </div>
  )
}

// ─── AgendaItemCard ───────────────────────────────────────────────────────────

function AgendaItemCard({
  item, index, agendaId, expanded, onToggle, onUpdate, isPending, router,
}: {
  item: any; index: number; agendaId: string; expanded: boolean
  onToggle: () => void; onUpdate: (payload: Record<string, unknown>) => void
  isPending: boolean; router: any
}) {
  const [resolution, setResolution]   = useState<'close' | 'demand' | null>(null)
  const [decisionText, setDecisionText] = useState(item.decisionMade ?? '')
  const [notes, setNotes]             = useState(item.notes ?? '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]   = useState(item.title)
  const [descDraft, setDescDraft]     = useState(item.description ?? '')

  const isDone      = item.status === 'done'
  const isDiscussed = item.status === 'discussed'
  const isDeferred  = item.status === 'deferred'

  function handleCheck() {
    if (isDone) onUpdate({ status: 'pending', decisionMade: null })
    else onToggle()
  }

  function handleFinalize() {
    onUpdate({ status: 'done', decisionMade: decisionText || null, notes: notes || null })
    setResolution(null)
  }

  function handleDefer() {
    onUpdate({ status: 'deferred', notes: notes || null })
    setResolution(null)
    onToggle()
  }

  function handleCreateDemand() {
    const p = new URLSearchParams({ title: item.title, description: item.description ?? '', fromAgenda: agendaId })
    router.push(`/demandas/nova?${p.toString()}`)
  }

  return (
    <div className={cn('rounded-xl border transition-all', ITEM_STATUS_COLORS[item.status] ?? 'border-gray-200 bg-white')}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={handleCheck} disabled={isPending} className="flex-shrink-0 mt-0.5 transition-transform active:scale-90">
          {isDone      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : isDiscussed ? <CheckCircle2 className="w-5 h-5 text-blue-400" />
          : isDeferred  ? <Circle className="w-5 h-5 text-amber-400" />
          :               <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-mono">{String(index).padStart(2, '0')}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {item.origin ? (ORIGIN_LABELS[item.origin] ?? item.origin) : 'Manual'}
                </span>
                {isDeferred && <span className="text-xs text-amber-600 font-medium">Adiado</span>}
                {isDone     && <span className="text-xs text-green-600 font-medium">Concluído</span>}
              </div>
              {editingTitle ? (
                <div className="mt-1 space-y-2">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    placeholder="Título do item"
                    autoFocus
                    className="w-full text-sm font-medium border border-blue-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={2}
                    placeholder="Descrição (opcional)"
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onUpdate({ title: titleDraft.trim(), description: descDraft.trim() || null }); setEditingTitle(false) }}
                      disabled={isPending || !titleDraft.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-3 h-3" /> Salvar
                    </button>
                    <button onClick={() => { setTitleDraft(item.title); setDescDraft(item.description ?? ''); setEditingTitle(false) }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 group/title">
                  <p className={cn('text-sm font-medium mt-0.5', isDone ? 'line-through text-gray-400' : 'text-gray-900')}>
                    {item.title}
                  </p>
                  <button
                    onClick={() => { setTitleDraft(item.title); setDescDraft(item.description ?? ''); setEditingTitle(true) }}
                    title="Editar nome"
                    className="mt-0.5 text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              {!editingTitle && item.description && !expanded && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
              )}
            </div>
            <button onClick={onToggle} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {item.description && <p className="text-sm text-gray-600 whitespace-pre-line">{item.description}</p>}

          <div className="flex flex-wrap gap-3">
            {item.report && (
              <Link href={`/reports/${item.report.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Report: {item.report.title}
              </Link>
            )}
            {item.demand && (
              <Link href={`/demandas/${item.demand.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Demanda: {item.demand.title}
              </Link>
            )}
          </div>

          {/* Registro deste item (Evoluções / Situação / Próximos Passos) */}
          <div className="space-y-2">
            <EditableSection
              label="Evoluções"
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              value={item.evolucoes ?? null}
              placeholder="O que evoluiu neste tema desde a última vez…"
              onSave={async (v) => { onUpdate({ evolucoes: v || null }) }}
              rows={2}
            />
            <EditableSection
              label="Situação atual"
              icon={<BarChart2 className="w-3.5 h-3.5" />}
              value={item.situacao ?? null}
              placeholder="Como está a situação deste tema agora…"
              onSave={async (v) => { onUpdate({ situacao: v || null }) }}
              rows={2}
            />
            <EditableSection
              label="Próximos passos"
              icon={<Footprints className="w-3.5 h-3.5" />}
              value={item.proximosPassos ?? null}
              placeholder="Encaminhamentos e ações deste tema…"
              onSave={async (v) => { onUpdate({ proximosPassos: v || null }) }}
              rows={2}
            />
          </div>

          {isDone && item.decisionMade && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-green-700 mb-0.5">Decisão registrada</p>
              <p className="text-sm text-green-800 whitespace-pre-line">{item.decisionMade}</p>
            </div>
          )}

          {!isDone && (
            <div className="space-y-3">
              {resolution === null && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => onUpdate({ status: 'discussed' })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" /> Marcar como discutido
                  </button>
                  <button onClick={() => setResolution('close')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Encerrar item
                  </button>
                  <button onClick={() => setResolution('demand')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Gerar Demanda
                  </button>
                  <button onClick={handleDefer}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" /> Adiar
                  </button>
                </div>
              )}

              {resolution === 'close' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-green-800">Registrar encerramento</p>
                  <div>
                    <label className="text-xs text-green-700 font-medium">Decisão / conclusão</label>
                    <textarea rows={3} value={decisionText} onChange={(e) => setDecisionText(e.target.value)}
                      placeholder="Descreva o que foi decidido ou o encaminhamento dado..."
                      className="mt-1 w-full px-3 py-2 border border-green-200 rounded-lg text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div>
                    <label className="text-xs text-green-700 font-medium">Anotações adicionais (opcional)</label>
                    <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações da reunião..."
                      className="mt-1 w-full px-3 py-2 border border-green-200 rounded-lg text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleFinalize} disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar encerramento
                    </button>
                    <button onClick={() => setResolution(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                  </div>
                </div>
              )}

              {resolution === 'demand' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">Gerar demanda a partir deste item</p>
                  <p className="text-xs text-amber-700">Você será redirecionado para criar uma demanda com o título pré-preenchido.</p>
                  <div className="flex gap-2">
                    <button onClick={handleCreateDemand}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700">
                      <Plus className="w-3.5 h-3.5" /> Criar Demanda
                    </button>
                    <button onClick={() => setResolution(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isDone && item.notes && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 mb-0.5">Anotações</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{item.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
