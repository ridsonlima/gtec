'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Megaphone, Plus, X, Check, CheckCircle2, AlertTriangle, Info, Users, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Area = { id: string; name: string }

interface Comunicado {
  id: string
  title: string
  body: string
  prioridade: 'normal' | 'importante' | 'urgente'
  alvoTipo: string
  alvoArea: { id: string; name: string } | null
  exigeAceite: boolean
  author: { id: string; name: string }
  createdAt: string
  minhaLeitura: { lidoEm: string; aceiteEm: string | null } | null
  totalAceites: number
}

const PRIORIDADE_META: Record<string, { label: string; cls: string; icon: any }> = {
  normal:     { label: 'Informativo', cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Info },
  importante: { label: 'Importante',  cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: AlertTriangle },
  urgente:    { label: 'Urgente',     cls: 'bg-red-50 text-red-700 border-red-200',         icon: AlertTriangle },
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ComunicadosClient({ canCreate, areas, currentUserId }: { canCreate: boolean; areas: Area[]; currentUserId: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['comunicados'],
    queryFn: () => fetch('/api/comunicados').then((r) => r.json()),
  })
  const comunicados: Comunicado[] = data?.data ?? []

  const pendentes = comunicados.filter((c) => c.exigeAceite && !c.minhaLeitura?.aceiteEm)

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-600" /> Comunicados
          </h1>
          <p className="text-sm text-gray-500 mt-1">Comunicação oficial da empresa. Confirme a ciência dos comunicados que exigem.</p>
        </div>
        {canCreate && !showForm && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98]">
            <Plus className="w-4 h-4" /> Novo comunicado
          </button>
        )}
      </div>

      {/* Banner de pendências de ciência */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Você tem <span className="font-semibold">{pendentes.length}</span> comunicado{pendentes.length > 1 ? 's' : ''} aguardando sua <span className="font-semibold">ciência</span>.
          </p>
        </div>
      )}

      {/* Formulário */}
      {showForm && <NovoComunicadoForm areas={areas} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['comunicados'] }) }} />}

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : comunicados.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Megaphone className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum comunicado publicado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comunicados.map((c) => (
            <ComunicadoCard key={c.id} c={c} canManage={canCreate} currentUserId={currentUserId} onChange={() => qc.invalidateQueries({ queryKey: ['comunicados'] })} />
          ))}
        </div>
      )}
    </div>
  )
}

function ComunicadoCard({ c, canManage, currentUserId, onChange }: { c: Comunicado; canManage: boolean; currentUserId: string; onChange: () => void }) {
  const qcCard = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [expandLeituras, setExpandLeituras] = useState(false)
  const [leituras, setLeituras] = useState<any[]>([])
  const meta = PRIORIDADE_META[c.prioridade] ?? PRIORIDADE_META.normal
  const Icon = meta.icon
  const jaConfirmou = !!c.minhaLeitura?.aceiteEm
  const ehAutor = c.author.id === currentUserId
  const podeEncerrar = canManage && ehAutor

  async function confirmar() {
    setLoading(true)
    try {
      await fetch(`/api/comunicados/${c.id}/aceite`, { method: 'POST' })
      onChange()
      qcCard.invalidateQueries({ queryKey: ['comunicados-pendentes'] })
    } finally { setLoading(false) }
  }

  async function encerrar() {
    if (!confirm('Encerrar este comunicado? Ele deixará de aparecer para a equipe.')) return
    setLoading(true)
    try {
      await fetch(`/api/comunicados/${c.id}`, { method: 'DELETE' })
      onChange()
    } finally { setLoading(false) }
  }

  async function verLeituras() {
    if (expandLeituras) { setExpandLeituras(false); return }
    const res = await fetch(`/api/comunicados/${c.id}`).then((r) => r.json())
    setLeituras(res.data?.leituras ?? [])
    setExpandLeituras(true)
  }

  return (
    <div className={cn('bg-white rounded-xl border p-5 space-y-3', jaConfirmou || !c.exigeAceite ? 'border-gray-200' : 'border-amber-300 shadow-sm')}>
      {/* Topo */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', meta.cls)}>
              <Icon className="w-3 h-3" /> {meta.label}
            </span>
            {c.alvoArea
              ? <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{c.alvoArea.name}</span>
              : <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Todos</span>}
            {c.exigeAceite && (
              <span className="text-xs text-gray-400">· exige ciência</span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900">{c.title}</h3>
        </div>
        {podeEncerrar && (
          <button onClick={encerrar} disabled={loading} className="p-1.5 text-gray-300 hover:text-red-600 transition-colors flex-shrink-0" title="Encerrar comunicado">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Corpo */}
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>

      {/* Rodapé */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">Por {c.author.name} · {fmtData(c.createdAt)}</p>

        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={verLeituras} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
              <Users className="w-3.5 h-3.5" /> {c.totalAceites} ciente{c.totalAceites !== 1 ? 's' : ''}
              {expandLeituras ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {c.exigeAceite && (
            jaConfirmou ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ciência confirmada
              </span>
            ) : (
              <button onClick={confirmar} disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> {loading ? 'Confirmando…' : 'Confirmar ciência'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Lista de quem deu ciência */}
      {expandLeituras && (
        <div className="pt-2 border-t border-gray-100">
          {leituras.filter((l) => l.aceiteEm).length === 0 ? (
            <p className="text-xs text-gray-400">Ninguém confirmou ciência ainda.</p>
          ) : (
            <ul className="space-y-1">
              {leituras.filter((l) => l.aceiteEm).map((l) => (
                <li key={l.id} className="text-xs text-gray-600 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  {l.user.name} · {fmtData(l.aceiteEm)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function NovoComunicadoForm({ areas, onClose, onSaved }: { areas: Area[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [prioridade, setPrioridade] = useState('normal')
  const [alvoTipo, setAlvoTipo] = useState('todos')
  const [alvoAreaId, setAlvoAreaId] = useState('')
  const [exigeAceite, setExigeAceite] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function salvar() {
    if (!title.trim()) return setError('Informe o título')
    if (!body.trim()) return setError('Informe o conteúdo')
    if (alvoTipo === 'area' && !alvoAreaId) return setError('Selecione a área')
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, prioridade, alvoTipo, alvoAreaId: alvoTipo === 'area' ? alvoAreaId : null, exigeAceite }),
      })
      const d = await res.json()
      if (!res.ok || d?.success === false) { setError(d?.error ?? 'Erro ao publicar'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Megaphone className="w-4 h-4 text-blue-600" /> Novo comunicado</h2>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Nova política de ponto a partir de junho" className={INPUT} autoFocus />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Conteúdo *</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Escreva o comunicado oficial…" className={`${INPUT} resize-y`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={INPUT}>
            <option value="normal">Informativo</option>
            <option value="importante">Importante</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Destinatário</label>
          <select value={alvoTipo} onChange={(e) => setAlvoTipo(e.target.value)} className={INPUT}>
            <option value="todos">Todos</option>
            <option value="area">Área específica</option>
          </select>
        </div>
      </div>

      {alvoTipo === 'area' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Área *</label>
          <select value={alvoAreaId} onChange={(e) => setAlvoAreaId(e.target.value)} className={INPUT}>
            <option value="">Selecione…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={exigeAceite} onChange={(e) => setExigeAceite(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        Exigir confirmação de ciência (leitura obrigatória)
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
        <button onClick={salvar} disabled={saving} className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50">
          <Megaphone className="w-4 h-4" /> {saving ? 'Publicando…' : 'Publicar comunicado'}
        </button>
      </div>
    </div>
  )
}
