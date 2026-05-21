'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageSquarePlus, AlertTriangle, Wrench, Eye, Save, Pencil, X,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tipo = 'atualizacao' | 'problema_encontrado' | 'peca_substituida' | 'observacao'

const TIPO_META: Record<Tipo, { label: string; color: string; icon: React.ReactNode }> = {
  atualizacao:        { label: 'Atualização',          color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <MessageSquarePlus className="w-3 h-3" /> },
  problema_encontrado:{ label: 'Problema encontrado',  color: 'bg-red-100 text-red-700 border-red-200',      icon: <AlertTriangle className="w-3 h-3" /> },
  peca_substituida:   { label: 'Peça substituída',     color: 'bg-amber-100 text-amber-700 border-amber-200',icon: <Wrench className="w-3 h-3" /> },
  observacao:         { label: 'Observação',           color: 'bg-gray-100 text-gray-600 border-gray-200',   icon: <Eye className="w-3 h-3" /> },
}

// ─── Formulário de nova atualização ──────────────────────────────────────────

export function OSNewUpdateForm({ osId, osStatus }: { osId: string; osStatus: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [tipo, setTipo] = useState<Tipo>('atualizacao')
  const [custo, setCusto] = useState('')
  const [error, setError] = useState('')

  if (osStatus === 'cancelada') return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setError('Descreva o que foi feito'); return }
    setError('')

    const res = await fetch(`/api/frota/ordens-servico/${osId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tipo, custo: custo ? Number(custo) : null }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao registrar'); return }

    setContent('')
    setCusto('')
    setTipo('atualizacao')
    startTransition(() => router.refresh())
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registrar atividade</p>

      {/* Tipo */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TIPO_META) as Tipo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
              ${tipo === t ? TIPO_META[t].color : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            {TIPO_META[t].icon} {TIPO_META[t].label}
          </button>
        ))}
      </div>

      {/* Descrição */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          tipo === 'atualizacao'         ? 'Descreva o andamento do serviço...' :
          tipo === 'problema_encontrado' ? 'Descreva o problema identificado...' :
          tipo === 'peca_substituida'    ? 'Peça substituída, referência, motivo...' :
                                           'Observação adicional...'
        }
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
      />

      {/* Custo opcional */}
      {(tipo === 'peca_substituida' || tipo === 'atualizacao') && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 flex-shrink-0">Custo adicional (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
            placeholder="0,00"
            className="w-36 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <span className="text-xs text-gray-400">Será somado ao custo total da OS</span>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !content.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <MessageSquarePlus className="w-4 h-4" />
          {pending ? 'Registrando...' : 'Registrar'}
        </button>
      </div>
    </form>
  )
}

// ─── Feed de atualizações ─────────────────────────────────────────────────────

export function OSUpdatesFeed({ updates }: {
  updates: {
    id: string; content: string; tipo: string; custo: number | null
    createdAt: string; author: { name: string }
  }[]
}) {
  if (updates.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Histórico de atividades</p>
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
        <div className="space-y-4">
          {updates.map((u) => {
            const meta = TIPO_META[u.tipo as Tipo] ?? TIPO_META.observacao
            return (
              <div key={u.id} className="relative pl-9">
                {/* Dot */}
                <div className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center
                  ${u.tipo === 'problema_encontrado' ? 'bg-red-50 border-red-300' :
                    u.tipo === 'peca_substituida'    ? 'bg-amber-50 border-amber-300' :
                    u.tipo === 'atualizacao'         ? 'bg-blue-50 border-blue-300' :
                                                       'bg-gray-50 border-gray-300'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full
                    ${u.tipo === 'problema_encontrado' ? 'bg-red-400' :
                      u.tipo === 'peca_substituida'    ? 'bg-amber-400' :
                      u.tipo === 'atualizacao'         ? 'bg-blue-400' :
                                                         'bg-gray-400'}`}
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-xs font-medium text-gray-600">{u.author.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {u.custo != null && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          +{u.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' '}
                        {new Date(u.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{u.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Edição inline dos campos da OS ──────────────────────────────────────────

export function OSEditForm({ osId, os, osStatus }: {
  osId: string
  osStatus: string
  os: {
    descricao: string
    executante: string | null
    dataPrevista: string | null
    custo: number | null
    observacoes: string | null
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    descricao:    os.descricao,
    executante:   os.executante ?? '',
    dataPrevista: os.dataPrevista ? os.dataPrevista.slice(0, 10) : '',
    custo:        os.custo != null ? String(os.custo) : '',
    observacoes:  os.observacoes ?? '',
  })
  const [error, setError] = useState('')

  if (osStatus === 'cancelada') return null

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch(`/api/frota/ordens-servico/${osId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao:    form.descricao || undefined,
        executante:   form.executante || null,
        dataPrevista: form.dataPrevista || null,
        custo:        form.custo ? Number(form.custo) : null,
        observacoes:  form.observacoes || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
    setOpen(false)
    startTransition(() => router.refresh())
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" /> Editar OS
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Editar dados da OS</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2 block text-xs font-medium text-gray-600 space-y-1">
          <span>Descrição do serviço</span>
          <textarea
            value={form.descricao}
            onChange={set('descricao')}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Executante / Oficina</span>
          <input value={form.executante} onChange={set('executante')} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Prazo previsto</span>
          <input type="date" value={form.dataPrevista} onChange={set('dataPrevista')} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Custo total (R$)</span>
          <input type="number" min="0" step="0.01" value={form.custo} onChange={set('custo')} placeholder="0,00" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
        <label className="sm:col-span-2 block text-xs font-medium text-gray-600 space-y-1">
          <span>Observações gerais</span>
          <textarea
            value={form.observacoes}
            onChange={set('observacoes')}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Save className="w-4 h-4" />{pending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
