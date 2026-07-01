'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Repeat, Plus, Trash2, X, CalendarClock, Paperclip, User, Check,
  History, BarChart3, Clock, AlertTriangle, CheckCircle2, MessageSquarePlus, Lock, Undo2,
} from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'

type Member = { id: string; name: string }
type Anexo = any
type Registro = { id: string; texto: string | null; autor: string; createdAt: string; anexos: Anexo[] }
type Ocorrencia = {
  id: string | null
  periodo: string
  prazo: string
  estado: 'aberta' | 'entregue' | 'perdida'
  statusFechamento: string | null
  resumo: string | null
  fechadoEm: string | null
  fechadoPor: string | null
  registros: Registro[]
}
type Rotina = {
  id: string
  title: string
  descricao: string | null
  instrucoes: string | null
  frequencia: 'diaria' | 'semanal' | 'mensal'
  cicloLabel: string
  responsavel: { id: string; name: string }
  ehMinha: boolean
  ocorrencia: Ocorrencia
}

const FREQ_LABEL: Record<string, string> = { diaria: 'Diárias', semanal: 'Semanais', mensal: 'Mensais' }
const FREQ_ORDER = ['diaria', 'semanal', 'mensal']

const STATUS_META: Record<string, { label: string; cls: string }> = {
  concluida: { label: 'Concluída', cls: 'bg-green-100 text-green-700 border-green-200' },
  parcial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  pendencias: { label: 'Com pendências', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  nao_realizada: { label: 'Não realizada', cls: 'bg-red-100 text-red-700 border-red-200' },
}

const ESTADO_META: Record<string, { label: string; cls: string; Icon: any }> = {
  aberta: { label: 'Em aberto', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  entregue: { label: 'Entregue', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  perdida: { label: 'Perdida', cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle },
}

const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export function AreaRotinasPanel({ areaId, canManage, currentUserId, members }: {
  areaId: string; canManage: boolean; currentUserId: string; members: Member[]
}) {
  const [lente, setLente] = useState<'atual' | 'conformidade'>('atual')
  const [escopo, setEscopo] = useState<'minhas' | 'todas'>('minhas')
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['rotinas', areaId, escopo],
    queryFn: () => fetch(`/api/rotinas?areaId=${areaId}&escopo=${escopo}`).then((r) => r.json()),
    enabled: lente === 'atual',
  })
  const rotinas: Rotina[] = data?.data ?? []
  const refetch = () => qc.invalidateQueries({ queryKey: ['rotinas', areaId] })

  const grupos = useMemo(
    () => FREQ_ORDER.map((f) => ({ freq: f, items: rotinas.filter((r) => r.frequencia === f) })).filter((g) => g.items.length),
    [rotinas]
  )
  const resumo = useMemo(() => {
    const r = { aberta: 0, entregue: 0, perdida: 0 } as Record<string, number>
    for (const x of rotinas) r[x.ocorrencia.estado] = (r[x.ocorrencia.estado] ?? 0) + 1
    return r
  }, [rotinas])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Repeat className="w-4 h-4" /> Rotinas da área</h2>
          <p className="text-xs text-gray-500 mt-0.5">Entregas recorrentes com prazo, logbook e histórico. Nada some ao virar o ciclo.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* lente */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button onClick={() => setLente('atual')} className={`px-3 py-1.5 inline-flex items-center gap-1 ${lente === 'atual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}><CalendarClock className="w-3.5 h-3.5" /> Ciclo atual</button>
            {canManage && <button onClick={() => setLente('conformidade')} className={`px-3 py-1.5 inline-flex items-center gap-1 ${lente === 'conformidade' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}><BarChart3 className="w-3.5 h-3.5" /> Conformidade</button>}
          </div>
          {lente === 'atual' && canManage && (
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setEscopo('minhas')} className={`px-3 py-1.5 ${escopo === 'minhas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Minhas</button>
              <button onClick={() => setEscopo('todas')} className={`px-3 py-1.5 ${escopo === 'todas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Todas</button>
            </div>
          )}
          {lente === 'atual' && canManage && (
            <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" /> Nova rotina
            </button>
          )}
        </div>
      </div>

      {lente === 'conformidade' ? (
        <ConformidadePanel areaId={areaId} />
      ) : (
        <>
          {showForm && canManage && (
            <NovaRotinaForm areaId={areaId} members={members} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} />
          )}

          {rotinas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo do ciclo</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ResumoChip n={resumo.entregue} label="Entregues" cls="bg-green-50 text-green-700 border-green-200" />
                <ResumoChip n={resumo.aberta} label="Em aberto" cls="bg-amber-50 text-amber-700 border-amber-200" />
                <ResumoChip n={resumo.perdida} label="Perdidas" cls="bg-red-50 text-red-700 border-red-200" />
              </div>
            </div>
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
        </>
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
  const [novoTexto, setNovoTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [showFechar, setShowFechar] = useState(false)
  const [showHist, setShowHist] = useState(false)
  const oc = r.ocorrencia
  const podeAgir = r.ehMinha || canManage
  const estadoMeta = ESTADO_META[oc.estado]
  const fechado = oc.estado === 'entregue'

  async function adicionarRegistro() {
    setSaving(true)
    await fetch(`/api/rotinas/${r.id}/registro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: novoTexto }),
    }).catch(() => {})
    setSaving(false); setNovoTexto(''); onChange()
  }
  async function removerRegistro(registroId: string) {
    if (!confirm('Remover esta entrada do logbook?')) return
    await fetch(`/api/rotinas/${r.id}/registro?registroId=${registroId}`, { method: 'DELETE' }).catch(() => {})
    onChange()
  }
  async function reabrir() {
    if (!confirm('Reabrir o ciclo? O status de fechamento será limpo.')) return
    await fetch(`/api/rotinas/${r.id}/fechar`, { method: 'DELETE' }).catch(() => {})
    onChange()
  }
  async function excluir() {
    if (!confirm(`Remover a rotina "${r.title}"? O histórico dela deixa de aparecer.`)) return
    await fetch(`/api/rotinas/${r.id}`, { method: 'DELETE' }).catch(() => {})
    onChange()
  }

  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${oc.estado === 'entregue' ? 'border-green-200' : oc.estado === 'perdida' ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* cabeçalho */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-800">{r.title}</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${estadoMeta.cls}`}>
              <estadoMeta.Icon className="w-3 h-3" /> {estadoMeta.label}
            </span>
            {fechado && oc.statusFechamento && (
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_META[oc.statusFechamento]?.cls ?? ''}`}>
                {STATUS_META[oc.statusFechamento]?.label ?? oc.statusFechamento}
              </span>
            )}
          </div>
          {r.descricao && <p className="text-xs text-gray-400 mt-0.5">{r.descricao}</p>}

          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
            {escopo === 'todas' && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {r.responsavel.name}</span>}
            {oc.estado === 'perdida'
              ? <span className="text-red-600">Venceu {fmtDia(oc.prazo)} sem entrega</span>
              : fechado
                ? <span className="text-gray-500">Fechada {oc.fechadoEm ? timeAgo(oc.fechadoEm) : ''}{oc.fechadoPor ? ` · ${oc.fechadoPor}` : ''}</span>
                : <span className="text-amber-600">Vence {r.cicloLabel} · até {fmtDia(oc.prazo)}</span>}
          </div>

          {r.instrucoes && (
            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 border border-gray-100 rounded-md px-2 py-1.5">
              <span className="font-medium text-gray-600">O que entregar:</span> {r.instrucoes}
            </p>
          )}

          {fechado && oc.resumo && (
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line border-l-2 border-green-200 pl-2">{oc.resumo}</p>
          )}

          {/* Logbook do ciclo */}
          {oc.registros.length > 0 && (
            <div className="mt-2.5 space-y-2">
              {oc.registros.map((rg) => (
                <div key={rg.id} className="border border-gray-100 rounded-lg bg-gray-50/60 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500 inline-flex items-center gap-1"><MessageSquarePlus className="w-3 h-3" /> {rg.autor} · {timeAgo(rg.createdAt)}</span>
                    {podeAgir && !fechado && (
                      <button onClick={() => removerRegistro(rg.id)} className="text-gray-300 hover:text-red-500" aria-label="Remover registro"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  {rg.texto && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{rg.texto}</p>}
                  <div className="mt-1.5">
                    <AttachmentsPanel
                      initialAttachments={rg.anexos}
                      objectType="rotina_registro"
                      objectId={rg.id}
                      canUpload={podeAgir && !fechado}
                      currentUserId={currentUserId}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ações do responsável */}
          {podeAgir && !fechado && (
            <div className="mt-2.5 space-y-2">
              <div className="flex items-start gap-2">
                <textarea
                  value={novoTexto}
                  onChange={(e) => setNovoTexto(e.target.value)}
                  rows={1}
                  placeholder="Adicionar ao logbook desta rotina…"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={adicionarRegistro} disabled={saving} className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap">
                  <Paperclip className="w-3.5 h-3.5" /> {saving ? '…' : 'Registrar'}
                </button>
              </div>
              {!showFechar ? (
                <button onClick={() => setShowFechar(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                  <Check className="w-3.5 h-3.5" /> Fechar ciclo
                </button>
              ) : (
                <FecharCicloForm rotinaId={r.id} onClose={() => setShowFechar(false)} onDone={() => { setShowFechar(false); onChange() }} />
              )}
            </div>
          )}

          {/* rodapé de ações secundárias */}
          <div className="mt-2 flex items-center gap-3">
            <button onClick={() => setShowHist((v) => !v)} className="text-[11px] text-gray-400 hover:text-blue-600 inline-flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> {showHist ? 'Ocultar histórico' : 'Histórico'}
            </button>
            {fechado && podeAgir && (
              <button onClick={reabrir} className="text-[11px] text-gray-400 hover:text-amber-600 inline-flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" /> Reabrir ciclo</button>
            )}
          </div>

          {showHist && <HistoricoDrawer rotinaId={r.id} />}
        </div>

        {canManage && (
          <button onClick={excluir} className="text-gray-300 hover:text-red-500 flex-shrink-0" aria-label="Remover rotina"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  )
}

function FecharCicloForm({ rotinaId, onClose, onDone }: { rotinaId: string; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState('concluida')
  const [resumo, setResumo] = useState('')
  const [saving, setSaving] = useState(false)
  async function fechar() {
    setSaving(true)
    await fetch(`/api/rotinas/${rotinaId}/fechar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, resumo }),
    }).catch(() => {})
    setSaving(false); onDone()
  }
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="concluida">Concluída</option>
          <option value="parcial">Parcial</option>
          <option value="pendencias">Com pendências</option>
          <option value="nao_realizada">Não realizada</option>
        </select>
        <span className="text-[11px] text-gray-500">Fecha o ciclo com este status.</span>
      </div>
      <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={2} placeholder="Resumo do ciclo (opcional)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y" />
      <div className="flex items-center gap-2">
        <button onClick={fechar} disabled={saving} className="px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> {saving ? 'Fechando…' : 'Confirmar fechamento'}</button>
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-500">Cancelar</button>
      </div>
    </div>
  )
}

function HistoricoDrawer({ rotinaId }: { rotinaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rotina-historico', rotinaId],
    queryFn: () => fetch(`/api/rotinas/${rotinaId}/historico`).then((r) => r.json()),
  })
  const hist = data?.data
  const ocorrencias = hist?.ocorrencias ?? []

  if (isLoading) return <p className="mt-2 text-xs text-gray-400">Carregando histórico…</p>
  if (ocorrencias.length === 0) return <p className="mt-2 text-xs text-gray-400">Sem ciclos anteriores ainda.</p>

  return (
    <div className="mt-2 border-l-2 border-gray-100 pl-3 space-y-2">
      {ocorrencias.map((o: any) => {
        const em = ESTADO_META[o.estado]
        return (
          <div key={o.id} className="text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-600">{o.periodoLabel}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${em.cls}`}>
                <em.Icon className="w-2.5 h-2.5" /> {em.label}
              </span>
              {o.statusFechamento && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_META[o.statusFechamento]?.cls ?? ''}`}>
                  {STATUS_META[o.statusFechamento]?.label ?? o.statusFechamento}
                </span>
              )}
              {o.fechadoPor && <span className="text-gray-400">· {o.fechadoPor}</span>}
            </div>
            {o.resumo && <p className="text-gray-600 mt-0.5 whitespace-pre-line">{o.resumo}</p>}
            {o.registros.map((rg: any) => (
              <div key={rg.id} className="mt-1 text-gray-500">
                {rg.texto && <p className="whitespace-pre-line">— {rg.texto}</p>}
                {rg.anexos.length > 0 && <p className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Paperclip className="w-2.5 h-2.5" /> {rg.anexos.length} anexo(s)</p>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ConformidadePanel({ areaId }: { areaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rotinas-conformidade', areaId],
    queryFn: () => fetch(`/api/rotinas/conformidade?areaId=${areaId}`).then((r) => r.json()),
  })
  const conf = data?.data
  const rotinas = conf?.rotinas ?? []
  const totais = conf?.totais

  if (isLoading) return <p className="text-sm text-gray-400">Carregando conformidade…</p>
  if (rotinas.length === 0) return <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Nenhuma rotina para consolidar.</div>

  return (
    <div className="space-y-3">
      {totais && (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="No prazo (geral)" value={totais.noPrazoPct == null ? '—' : `${totais.noPrazoPct}%`} cls="text-blue-700" />
          <KpiCard label="Entregues" value={totais.entregues} cls="text-green-700" />
          <KpiCard label="Perdidas" value={totais.perdidas} cls={totais.perdidas ? 'text-red-600' : 'text-gray-400'} />
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-3 py-2 font-medium">Rotina</th>
              <th className="px-3 py-2 font-medium">Responsável</th>
              <th className="px-3 py-2 font-medium text-center">No prazo</th>
              <th className="px-3 py-2 font-medium text-center">Entregues</th>
              <th className="px-3 py-2 font-medium text-center">Perdidas</th>
              <th className="px-3 py-2 font-medium text-center">Sequência</th>
            </tr>
          </thead>
          <tbody>
            {rotinas.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2 text-gray-800">{r.title}</td>
                <td className="px-3 py-2 text-gray-500">{r.responsavel.name}</td>
                <td className="px-3 py-2 text-center">
                  {r.noPrazoPct == null
                    ? <span className="text-gray-300">—</span>
                    : <span className={`font-semibold ${r.noPrazoPct >= 80 ? 'text-green-700' : r.noPrazoPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{r.noPrazoPct}%</span>}
                </td>
                <td className="px-3 py-2 text-center text-gray-700">{r.entregues}</td>
                <td className="px-3 py-2 text-center">{r.perdidas ? <span className="text-red-600 font-semibold">{r.perdidas}</span> : <span className="text-gray-300">0</span>}</td>
                <td className="px-3 py-2 text-center">{r.streak > 0 ? <span className="text-green-700 font-semibold">🔥 {r.streak}</span> : <span className="text-gray-300">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">Considera apenas ciclos já encerrados (o ciclo atual em aberto não entra no cálculo).</p>
    </div>
  )
}

function KpiCard({ label, value, cls }: { label: string; value: any; cls: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${cls}`}>{value}</p>
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
