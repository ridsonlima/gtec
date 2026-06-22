'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Repeat, Plus, Check, Trash2, X, CalendarClock, Paperclip, User } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'

type Member = { id: string; name: string }
type Rotina = {
  id: string
  title: string
  descricao: string | null
  instrucoes: string | null
  frequencia: 'diaria' | 'semanal' | 'mensal'
  cicloLabel: string
  responsavel: { id: string; name: string }
  ehMinha: boolean
  entrega: null | {
    id: string
    status: string
    texto: string | null
    concluidoEm: string
    concluidoPor: string
    anexos: any[]
  }
}

const FREQ_LABEL: Record<string, string> = { diaria: 'Diárias', semanal: 'Semanais', mensal: 'Mensais' }
const FREQ_ORDER = ['diaria', 'semanal', 'mensal']

const STATUS_META: Record<string, { label: string; cls: string }> = {
  concluida: { label: 'Concluída', cls: 'bg-green-100 text-green-700 border-green-200' },
  parcial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  pendencias: { label: 'Com pendências', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  nao_realizada: { label: 'Não realizada', cls: 'bg-red-100 text-red-700 border-red-200' },
}

export function AreaRotinasPanel({ areaId, canManage, currentUserId, members }: {
  areaId: string; canManage: boolean; currentUserId: string; members: Member[]
}) {
  const [escopo, setEscopo] = useState<'minhas' | 'todas'>('minhas')
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['rotinas', areaId, escopo],
    queryFn: () => fetch(`/api/rotinas?areaId=${areaId}&escopo=${escopo}`).then((r) => r.json()),
  })
  const rotinas: Rotina[] = data?.data ?? []
  const refetch = () => qc.invalidateQueries({ queryKey: ['rotinas', areaId, escopo] })

  const grupos = useMemo(
    () => FREQ_ORDER.map((f) => ({ freq: f, items: rotinas.filter((r) => r.frequencia === f) })).filter((g) => g.items.length),
    [rotinas]
  )
  const feitas = rotinas.filter((r) => r.entrega).length
  const resumo = useMemo(() => {
    const r = { pendente: 0, concluida: 0, parcial: 0, pendencias: 0, nao_realizada: 0 } as Record<string, number>
    for (const x of rotinas) {
      if (!x.entrega) r.pendente++
      else r[x.entrega.status] = (r[x.entrega.status] ?? 0) + 1
    }
    return r
  }, [rotinas])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Repeat className="w-4 h-4" /> Rotinas da área</h2>
          <p className="text-xs text-gray-500 mt-0.5">Entregas recorrentes — cada um vê as suas; o líder vê todas.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setEscopo('minhas')} className={`px-3 py-1.5 ${escopo === 'minhas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Minhas</button>
              <button onClick={() => setEscopo('todas')} className={`px-3 py-1.5 ${escopo === 'todas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Todas</button>
            </div>
          )}
          {canManage && (
            <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" /> Nova rotina
            </button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <NovaRotinaForm areaId={areaId} members={members} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} />
      )}

      {rotinas.length > 0 && canManage ? (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo do ciclo</span>
            <span className="text-xs text-gray-500">{feitas}/{rotinas.length} entregues</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ResumoChip n={resumo.concluida} label="Concluídas" cls="bg-green-50 text-green-700 border-green-200" />
            <ResumoChip n={resumo.parcial} label="Parciais" cls="bg-amber-50 text-amber-700 border-amber-200" />
            <ResumoChip n={resumo.pendencias} label="Com pendências" cls="bg-orange-50 text-orange-700 border-orange-200" />
            <ResumoChip n={resumo.nao_realizada} label="Não realizadas" cls="bg-red-50 text-red-700 border-red-200" />
            <ResumoChip n={resumo.pendente} label="Pendentes (sem entrega)" cls="bg-gray-100 text-gray-600 border-gray-200" />
          </div>
        </div>
      ) : (
        rotinas.length > 0 && <p className="text-xs text-gray-500">{feitas}/{rotinas.length} entregues no ciclo atual</p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : rotinas.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
          {escopo === 'minhas' ? 'Você não tem rotinas nesta área.' : 'Nenhuma rotina cadastrada nesta área.'}
          {canManage && <span className="block mt-1">Crie em “Nova rotina”.</span>}
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.freq}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> {FREQ_LABEL[g.freq]}</h3>
              <div className="space-y-2">
                {g.items.map((r) => (
                  <RotinaCard key={r.id} r={r} escopo={escopo} canManage={canManage} currentUserId={currentUserId} onChange={refetch} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResumoChip({ n, label, cls }: { n: number; label: string; cls: string }) {
  if (!n) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
      <span className="font-bold">{n}</span> {label}
    </span>
  )
}

function RotinaCard({ r, escopo, canManage, currentUserId, onChange }: {
  r: Rotina; escopo: 'minhas' | 'todas'; canManage: boolean; currentUserId: string; onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState('concluida')
  const [saving, setSaving] = useState(false)
  const podeEntregar = r.ehMinha || canManage
  const entregue = !!r.entrega

  async function concluir() {
    setSaving(true)
    await fetch(`/api/rotinas/${r.id}/concluir`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, status }),
    }).catch(() => {})
    setSaving(false); setOpen(false); setTexto(''); setStatus('concluida'); onChange()
  }
  async function desfazer() {
    if (!confirm('Desfazer a entrega deste ciclo?')) return
    await fetch(`/api/rotinas/${r.id}/concluir`, { method: 'DELETE' }).catch(() => {})
    onChange()
  }
  async function excluir() {
    if (!confirm(`Remover a rotina "${r.title}"?`)) return
    await fetch(`/api/rotinas/${r.id}`, { method: 'DELETE' }).catch(() => {})
    onChange()
  }

  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${entregue ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${entregue ? 'bg-green-600 text-white' : 'border border-gray-300'}`}>
          {entregue && <Check className="w-3.5 h-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800">{r.title}</p>
          {r.descricao && <p className="text-xs text-gray-400 mt-0.5">{r.descricao}</p>}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
            {escopo === 'todas' && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {r.responsavel.name}</span>}
            {entregue && r.entrega!.status && (
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_META[r.entrega!.status]?.cls ?? ''}`}>
                {STATUS_META[r.entrega!.status]?.label ?? r.entrega!.status}
              </span>
            )}
            {entregue
              ? <span className="text-gray-500">Entregue {r.cicloLabel} · {r.entrega!.concluidoPor} · {timeAgo(r.entrega!.concluidoEm)}</span>
              : <span className="text-amber-600">Pendente {r.cicloLabel}</span>}
          </div>
          {r.instrucoes && (
            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 border border-gray-100 rounded-md px-2 py-1.5">
              <span className="font-medium text-gray-600">O que entregar:</span> {r.instrucoes}
            </p>
          )}

          {entregue && r.entrega!.texto && (
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line border-l-2 border-green-200 pl-2">{r.entrega!.texto}</p>
          )}

          {entregue && (
            <div className="mt-2">
              <AttachmentsPanel
                initialAttachments={r.entrega!.anexos}
                objectType="rotina_entrega"
                objectId={r.entrega!.id}
                canUpload={podeEntregar}
                currentUserId={currentUserId}
              />
            </div>
          )}

          {!entregue && podeEntregar && !open && (
            <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
              <Paperclip className="w-3.5 h-3.5" /> Entregar
            </button>
          )}

          {!entregue && open && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="concluida">Concluída</option>
                  <option value="parcial">Parcial</option>
                  <option value="pendencias">Com pendências</option>
                  <option value="nao_realizada">Não realizada</option>
                </select>
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Resumo do que foi feito (opcional)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y" />
              <div className="flex items-center gap-2">
                <button onClick={concluir} disabled={saving} className="px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Salvando…' : 'Marcar entregue'}
                </button>
                <button onClick={() => { setOpen(false); setTexto('') }} className="px-3 py-1.5 text-xs text-gray-500">Cancelar</button>
                <span className="text-[11px] text-gray-400">Você poderá anexar arquivos após marcar.</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {entregue && podeEntregar && (
            <button onClick={desfazer} className="text-[11px] text-gray-400 hover:text-amber-600">Desfazer</button>
          )}
          {canManage && (
            <button onClick={excluir} className="text-gray-300 hover:text-red-500" aria-label="Remover rotina"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
  )
}

function NovaRotinaForm({ areaId, members, onClose, onSaved }: {
  areaId: string; members: Member[]; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [descricao, setDescricao] = useState('')
  const [instrucoes, setInstrucoes] = useState('')
  const [frequencia, setFrequencia] = useState('semanal')
  const [responsavelId, setResponsavelId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  async function salvar() {
    if (!title.trim()) return setError('Informe o título')
    if (!responsavelId) return setError('Selecione o responsável')
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/rotinas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, title, descricao, instrucoes, frequencia, responsavelId }),
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
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Relatório de entrega da Segurança do Trabalho" className={INPUT} autoFocus />
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Descrição (opcional)" className={`${INPUT} resize-y`} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">O que precisa ser entregue (roteiro)</label>
        <textarea value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} rows={2} placeholder="Ex: Anexar o PDF assinado + informar nº de inspeções realizadas" className={`${INPUT} resize-y`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={INPUT}>
            <option value="">Selecione…</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
          <select value={frequencia} onChange={(e) => setFrequencia(e.target.value)} className={INPUT}>
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
        <button onClick={salvar} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Salvando…' : 'Criar rotina'}</button>
      </div>
    </div>
  )
}
