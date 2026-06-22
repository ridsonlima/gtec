'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Repeat, Plus, Check, Trash2, X, CalendarClock } from 'lucide-react'

type Area = { id: string; name: string }
type Rotina = {
  id: string
  title: string
  descricao: string | null
  frequencia: 'diaria' | 'semanal' | 'mensal'
  cicloLabel: string
  concluidoNoCiclo: boolean
}

const FREQ_LABEL: Record<string, string> = { diaria: 'Diárias', semanal: 'Semanais', mensal: 'Mensais' }
const FREQ_ORDER = ['diaria', 'semanal', 'mensal']

export function RotinasClient({ areas, canManage }: { areas: Area[]; canManage: boolean }) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '')
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['rotinas', areaId],
    queryFn: () => fetch(`/api/rotinas?areaId=${areaId}`).then((r) => r.json()),
    enabled: !!areaId,
  })
  const rotinas: Rotina[] = data?.data ?? []

  const grupos = useMemo(
    () => FREQ_ORDER.map((f) => ({ freq: f, items: rotinas.filter((r) => r.frequencia === f) })).filter((g) => g.items.length),
    [rotinas]
  )

  async function toggle(r: Rotina) {
    qc.setQueryData(['rotinas', areaId], (old: any) => old?.data ? { ...old, data: old.data.map((x: Rotina) => x.id === r.id ? { ...x, concluidoNoCiclo: !r.concluidoNoCiclo } : x) } : old)
    await fetch(`/api/rotinas/${r.id}/concluir`, { method: r.concluidoNoCiclo ? 'DELETE' : 'POST' }).catch(() => {})
    qc.invalidateQueries({ queryKey: ['rotinas', areaId] })
  }

  async function excluir(r: Rotina) {
    if (!confirm(`Remover a rotina "${r.title}"?`)) return
    await fetch(`/api/rotinas/${r.id}`, { method: 'DELETE' }).catch(() => {})
    qc.invalidateQueries({ queryKey: ['rotinas', areaId] })
  }

  if (areas.length === 0) {
    return <p className="text-sm text-gray-500">Você não está vinculado a nenhuma área.</p>
  }

  const feitas = rotinas.filter((r) => r.concluidoNoCiclo).length

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Repeat className="w-5 h-5" /> Rotinas da Área</h1>
          <p className="text-sm text-gray-500 mt-0.5">Atividades recorrentes da área — fora das demandas. Marque o que já foi feito no ciclo.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nova rotina
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {areas.length > 1 && (
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        {rotinas.length > 0 && (
          <span className="text-xs text-gray-500">{feitas}/{rotinas.length} concluídas no ciclo atual</span>
        )}
      </div>

      {showForm && canManage && (
        <NovaRotinaForm areaId={areaId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['rotinas', areaId] }) }} />
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : rotinas.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          Nenhuma rotina cadastrada para esta área.
          {canManage && <span className="block mt-1">Crie a primeira em “Nova rotina”.</span>}
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.freq}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> {FREQ_LABEL[g.freq]}
              </h2>
              <div className="space-y-2">
                {g.items.map((r) => (
                  <div key={r.id} className={`flex items-start gap-3 bg-white rounded-xl border px-4 py-3 ${r.concluidoNoCiclo ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
                    <button
                      onClick={() => toggle(r)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${r.concluidoNoCiclo ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 hover:border-blue-500'}`}
                      aria-label={r.concluidoNoCiclo ? 'Desmarcar' : 'Marcar como feita'}
                    >
                      {r.concluidoNoCiclo && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${r.concluidoNoCiclo ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{r.title}</p>
                      {r.descricao && <p className="text-xs text-gray-400 mt-0.5">{r.descricao}</p>}
                      <p className="text-xs mt-1">
                        {r.concluidoNoCiclo
                          ? <span className="text-green-600">Feita {r.cicloLabel}</span>
                          : <span className="text-amber-600">Pendente {r.cicloLabel}</span>}
                      </p>
                    </div>
                    {canManage && (
                      <button onClick={() => excluir(r)} className="text-gray-300 hover:text-red-500 flex-shrink-0" aria-label="Remover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NovaRotinaForm({ areaId, onClose, onSaved }: { areaId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [descricao, setDescricao] = useState('')
  const [frequencia, setFrequencia] = useState('semanal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  async function salvar() {
    if (!title.trim()) return setError('Informe o título')
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/rotinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, title, descricao, frequencia }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d?.error ?? 'Erro ao salvar'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Nova rotina</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Acompanhamento ambiental nas frentes" className={INPUT} autoFocus />
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Descrição (opcional)" className={`${INPUT} resize-y`} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
        <select value={frequencia} onChange={(e) => setFrequencia(e.target.value)} className={INPUT}>
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
        <button onClick={salvar} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Salvando…' : 'Criar rotina'}
        </button>
      </div>
    </div>
  )
}
