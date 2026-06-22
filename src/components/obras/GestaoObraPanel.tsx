'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldAlert, OctagonAlert, TrendingUp, Plus, X, Loader2, CheckCircle2,
  AlertTriangle, Clock, Camera, ChevronDown, ChevronUp, ArrowRight, Trash2,
} from 'lucide-react'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const hojeISO = () => new Date().toISOString().slice(0, 10)
const diasEntre = (a: string | Date, b: Date = new Date()) => Math.max(0, Math.floor((b.getTime() - new Date(a).getTime()) / 86400000))

const CATEGORIA_LABEL: Record<string, string> = {
  material: 'Material', licenca: 'Licença', projeto: 'Projeto', frente: 'Frente de serviço',
  mao_obra: 'Mão de obra', equipamento: 'Equipamento', outro: 'Outro',
}

interface Usuario { id: string; name: string }
interface Contrato { id: string; number: string; name: string }
interface Restricao {
  id: string; descricao: string; categoria: string; impacto: string | null
  prazo: string; status: string; responsavel: { id: string; name: string }
}
interface Interferencia {
  id: string; tipo: string; local: string | null; descricao: string
  responsavelExterno: string | null; dataInicio: string; dataFim: string | null; status: string
  createdBy: { name: string }
}
interface Avanco {
  id: string; dataRef: string; trecho: string; unidade: string
  planejado: number; executado: number; observacao: string | null
}

type Tab = 'restricoes' | 'interferencias' | 'avanco'

export function GestaoObraPanel() {
  const [contratoId, setContratoId] = useState('')
  const [tab, setTab] = useState<Tab>('restricoes')

  const { data, isLoading } = useQuery({
    queryKey: ['obras', contratoId],
    queryFn: () => fetch(`/api/obras${contratoId ? `?contratoId=${contratoId}` : ''}`).then((r) => r.json()),
  })

  const contratos: Contrato[] = data?.data?.contratos ?? []
  const restricoes: Restricao[] = data?.data?.restricoes ?? []
  const interferencias: Interferencia[] = data?.data?.interferencias ?? []
  const avancos: Avanco[] = data?.data?.avancos ?? []
  const usuarios: Usuario[] = data?.data?.usuarios ?? []

  // KPIs
  const restAbertas = restricoes.filter((r) => r.status === 'aberta')
  const restVencidas = restAbertas.filter((r) => new Date(r.prazo) < new Date())
  const intAbertas = interferencias.filter((i) => i.status === 'aberta')
  const diasParados = interferencias.reduce((s, i) => s + diasEntre(i.dataInicio, i.dataFim ? new Date(i.dataFim) : new Date()), 0)
  // avanço: % médio dos trechos (última medição de cada)
  const ultimoPorTrecho = new Map<string, Avanco>()
  for (const a of avancos) if (!ultimoPorTrecho.has(a.trecho)) ultimoPorTrecho.set(a.trecho, a) // avancos já vem desc
  const trechos = Array.from(ultimoPorTrecho.values())
  const pctMedio = trechos.length > 0
    ? Math.round(trechos.reduce((s, t) => s + (t.planejado > 0 ? Math.min(t.executado / t.planejado, 1.5) : 0), 0) / trechos.length * 100)
    : null

  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'restricoes', label: 'Restrições', icon: <ShieldAlert className="w-4 h-4" />, badge: restVencidas.length },
    { key: 'interferencias', label: 'Interferências', icon: <OctagonAlert className="w-4 h-4" />, badge: intAbertas.length },
    { key: 'avanco', label: 'Avanço Físico', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          Restrições (o que vai travar), interferências/paralisações e avanço físico por trecho — sempre olhando pra frente.
        </p>
        <select
          value={contratoId}
          onChange={(e) => setContratoId(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white min-w-[240px]"
        >
          <option value="">Selecione a obra (contrato)…</option>
          {contratos.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.name}</option>)}
        </select>
      </div>

      {!contratoId ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Selecione uma obra para gerenciar restrições, interferências e avanço.
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Restrições abertas" value={restAbertas.length} alert={restVencidas.length > 0 ? `${restVencidas.length} vencida(s)` : undefined} />
            <KpiCard label="Interferências abertas" value={intAbertas.length} />
            <KpiCard label="Dias parados (acum.)" value={diasParados} />
            <KpiCard label="Avanço médio" value={pctMedio !== null ? `${pctMedio}%` : '—'} />
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}{t.label}
                {!!t.badge && t.badge > 0 && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{t.badge}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'restricoes' && <RestricoesTab contratoId={contratoId} restricoes={restricoes} usuarios={usuarios} />}
          {tab === 'interferencias' && <InterferenciasTab contratoId={contratoId} interferencias={interferencias} />}
          {tab === 'avanco' && <AvancoTab contratoId={contratoId} avancos={avancos} trechos={trechos} />}
        </>
      )}
      <style jsx global>{`
        .ginput { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
        .ginput:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
      `}</style>
    </div>
  )
}

function KpiCard({ label, value, alert }: { label: string; value: number | string; alert?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {alert && <p className="text-[11px] font-semibold text-red-600 mt-0.5">{alert}</p>}
    </div>
  )
}

// ─── Restrições (lookahead) ───────────────────────────────────────────────────

function RestricoesTab({ contratoId, restricoes, usuarios }: { contratoId: string; restricoes: Restricao[]; usuarios: Usuario[] }) {
  const qc = useQueryClient()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('outro')
  const [impacto, setImpacto] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [prazo, setPrazo] = useState('')

  const refresh = () => qc.invalidateQueries({ queryKey: ['obras', contratoId] })

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/obras/restricoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId, descricao, categoria, impacto: impacto || null, responsavelId, prazo: new Date(prazo + 'T12:00:00').toISOString() }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setDescricao(''); setImpacto(''); setPrazo(''); setResponsavelId(''); refresh() },
  })

  const patchM = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      await fetch(`/api/obras/restricoes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    },
    onSuccess: refresh,
  })

  const abertas = restricoes.filter((r) => r.status === 'aberta')
  const removidas = restricoes.filter((r) => r.status === 'removida')

  function gerarDemanda(r: Restricao) {
    const p = new URLSearchParams({
      title: `Remover restrição: ${r.descricao.slice(0, 80)}`,
      description: `Restrição de obra (${CATEGORIA_LABEL[r.categoria]}). Prazo: ${fmtData(r.prazo)}.\n${r.impacto ? `Impacto se não resolver: ${r.impacto}` : ''}`,
    })
    router.push(`/demandas/nova?${p.toString()}`)
  }

  return (
    <div className="space-y-3">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nova restrição
        </button>
      ) : (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase">O que pode travar a obra nas próximas semanas?</p>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="ginput resize-none" placeholder="Descreva a restrição (ex.: tubo DN300 sem previsão de entrega)…" autoFocus />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Categoria</span>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="ginput">
                {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Quem remove (dono) *</span>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="ginput">
                <option value="">Selecione…</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Resolver até *</span>
              <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="ginput" />
            </label>
          </div>
          <input value={impacto} onChange={(e) => setImpacto(e.target.value)} className="ginput" placeholder="Impacto se não resolver (opcional — ex.: para a frente da Rua B)" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createM.mutate()} disabled={createM.isPending || !descricao.trim() || !responsavelId || !prazo}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar
            </button>
          </div>
        </div>
      )}

      {abertas.length === 0 && !showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-sm text-green-800">
          Nenhuma restrição aberta — caminho livre nas próximas semanas. 🎉
        </div>
      )}

      <div className="space-y-2">
        {abertas.map((r) => {
          const vencida = new Date(r.prazo) < new Date()
          const dias = Math.ceil((new Date(r.prazo).getTime() - Date.now()) / 86400000)
          return (
            <div key={r.id} className={`bg-white rounded-xl border p-4 ${vencida ? 'border-l-4 border-l-red-500 border-gray-200' : dias <= 7 ? 'border-l-4 border-l-amber-400 border-gray-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-[11px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{CATEGORIA_LABEL[r.categoria]}</span>
                    {vencida
                      ? <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">VENCIDA</span>
                      : <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${dias <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{dias === 0 ? 'hoje' : `${dias}d`}</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{r.descricao}</p>
                  {r.impacto && <p className="text-xs text-gray-500 mt-0.5">Impacto: {r.impacto}</p>}
                  <p className="text-xs text-gray-400 mt-1">Dono: <span className="font-medium text-gray-600">{r.responsavel.name}</span> · até {fmtData(r.prazo)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => gerarDemanda(r)} title="Gerar demanda" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50">
                    <ArrowRight className="w-3.5 h-3.5" /> Demanda
                  </button>
                  <button onClick={() => patchM.mutate({ id: r.id, body: { status: 'removida' } })} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Removida
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {removidas.length > 0 && (
        <details className="text-sm">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">{removidas.length} restrição(ões) removida(s)</summary>
          <div className="mt-2 space-y-1.5">
            {removidas.map((r) => (
              <div key={r.id} className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 line-through">{r.descricao}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ─── Interferências / Paralisações ────────────────────────────────────────────

function InterferenciasTab({ contratoId, interferencias }: { contratoId: string; interferencias: Interferencia[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('interferencia')
  const [local, setLocal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [respExterno, setRespExterno] = useState('')
  const [dataInicio, setDataInicio] = useState(hojeISO())

  const refresh = () => qc.invalidateQueries({ queryKey: ['obras', contratoId] })

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/obras/interferencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId, tipo, local: local || null, descricao, responsavelExterno: respExterno || null, dataInicio: new Date(dataInicio + 'T12:00:00').toISOString() }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setLocal(''); setDescricao(''); setRespExterno(''); setDataInicio(hojeISO()); refresh() },
  })

  const resolverM = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/obras/interferencias/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolvida', dataFim: new Date().toISOString() }),
      })
    },
    onSuccess: refresh,
  })

  return (
    <div className="space-y-3">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Registrar interferência / paralisação
        </button>
      ) : (
        <div className="bg-red-50/40 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setTipo('interferencia')} className={`px-3 py-1 text-xs rounded-lg font-medium ${tipo === 'interferencia' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Interferência</button>
            <button onClick={() => setTipo('paralisacao')} className={`px-3 py-1 text-xs rounded-lg font-medium ${tipo === 'paralisacao' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Paralisação</button>
          </div>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="ginput resize-none" placeholder="O que foi encontrado / o que parou a frente…" autoFocus />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={local} onChange={(e) => setLocal(e.target.value)} className="ginput" placeholder="Local / trecho / estaca" />
            <input value={respExterno} onChange={(e) => setRespExterno(e.target.value)} className="ginput" placeholder="Quem resolve (concessionária, prefeitura…)" />
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span className="sr-only">Início</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="ginput" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createM.mutate()} disabled={createM.isPending || !descricao.trim()}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar
            </button>
          </div>
        </div>
      )}

      {interferencias.length === 0 && !showForm && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          Nenhuma interferência registrada nesta obra.
        </div>
      )}

      <div className="space-y-2">
        {interferencias.map((i) => (
          <InterferenciaCard key={i.id} item={i} onResolver={() => resolverM.mutate(i.id)} />
        ))}
      </div>
    </div>
  )
}

function InterferenciaCard({ item, onResolver }: { item: Interferencia; onResolver: () => void }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const aberta = item.status === 'aberta'
  const dias = diasEntre(item.dataInicio, item.dataFim ? new Date(item.dataFim) : new Date())

  const { data: detalhe } = useQuery({
    queryKey: ['interferencia', item.id],
    queryFn: () => fetch(`/api/obras/interferencias/${item.id}`).then((r) => r.json()),
    enabled: open,
  })

  return (
    <div className={`bg-white rounded-xl border p-4 ${aberta ? 'border-l-4 border-l-red-500 border-gray-200' : 'border-gray-200 opacity-80'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${item.tipo === 'paralisacao' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {item.tipo === 'paralisacao' ? 'Paralisação' : 'Interferência'}
            </span>
            {aberta
              ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full"><Clock className="w-3 h-3" /> {dias}d parado(s)</span>
              : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Resolvida ({dias}d)</span>}
          </div>
          <p className="text-sm font-medium text-gray-800">{item.descricao}</p>
          <p className="text-xs text-gray-400 mt-1">
            {item.local && <>Local: <span className="text-gray-600">{item.local}</span> · </>}
            {item.responsavelExterno && <>Resolve: <span className="text-gray-600">{item.responsavelExterno}</span> · </>}
            Início {fmtData(item.dataInicio)}{item.dataFim && <> · Fim {fmtData(item.dataFim)}</>} · por {item.createdBy.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-gray-50">
            <Camera className="w-3.5 h-3.5" /> Fotos {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {aberta && (
            <button onClick={onResolver} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" /> Resolvida
            </button>
          )}
        </div>
      </div>

      {open && session?.user && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {detalhe?.data ? (
            <AttachmentsPanel
              initialAttachments={detalhe.data.attachments ?? []}
              objectType="interferencia"
              objectId={item.id}
              canUpload
              currentUserId={session.user.id}
              canDeleteAll
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando fotos…</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Avanço Físico por trecho ─────────────────────────────────────────────────

function AvancoTab({ contratoId, avancos, trechos }: { contratoId: string; avancos: Avanco[]; trechos: Avanco[] }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [trecho, setTrecho] = useState('')
  const [unidade, setUnidade] = useState('m')
  const [planejado, setPlanejado] = useState('')
  const [executado, setExecutado] = useState('')
  const [dataRef, setDataRef] = useState(hojeISO())
  const [observacao, setObservacao] = useState('')

  const refresh = () => qc.invalidateQueries({ queryKey: ['obras', contratoId] })

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/obras/avancos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId, trecho, unidade,
          planejado: Number(planejado) || 0, executado: Number(executado) || 0,
          dataRef: new Date(dataRef + 'T12:00:00').toISOString(),
          observacao: observacao || null,
        }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setExecutado(''); setObservacao(''); refresh() },
  })

  const delM = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/obras/avancos/${id}`, { method: 'DELETE' }) },
    onSuccess: refresh,
  })

  const trechosExistentes = Array.from(new Set(avancos.map((a) => a.trecho)))

  return (
    <div className="space-y-4">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Lançar medição de avanço
        </button>
      ) : (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase">Acumulado até a data (planejado × executado)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-gray-600 space-y-1 col-span-2 sm:col-span-1">
              <span>Trecho / etapa *</span>
              <input value={trecho} onChange={(e) => setTrecho(e.target.value)} list="trechos-list" className="ginput" placeholder="Ex.: Rede Rua A" autoFocus />
              <datalist id="trechos-list">{trechosExistentes.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Unidade</span>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="ginput">
                {['m', 'm²', 'm³', 'un', 'lig', '%'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Data de referência</span>
              <input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} className="ginput" />
            </label>
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Planejado acumulado *</span>
              <input type="number" step="0.01" value={planejado} onChange={(e) => setPlanejado(e.target.value)} className="ginput" placeholder="0" />
            </label>
            <label className="block text-xs font-medium text-gray-600 space-y-1">
              <span>Executado acumulado *</span>
              <input type="number" step="0.01" value={executado} onChange={(e) => setExecutado(e.target.value)} className="ginput" placeholder="0" />
            </label>
          </div>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className="ginput" placeholder="Observação (opcional)" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createM.mutate()} disabled={createM.isPending || !trecho.trim() || planejado === ''}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Lançar
            </button>
          </div>
        </div>
      )}

      {/* Situação por trecho (última medição) */}
      {trechos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trechos.map((t) => {
            const pct = t.planejado > 0 ? Math.round((t.executado / t.planejado) * 100) : 0
            const atrasado = pct < 100
            return (
              <div key={t.trecho} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.trecho}</p>
                  <span className={`text-sm font-bold ${pct >= 100 ? 'text-green-600' : pct >= 85 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 85 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {t.executado.toLocaleString('pt-BR')} de {t.planejado.toLocaleString('pt-BR')} {t.unidade}
                  {atrasado && t.planejado > 0 && <span className="text-red-500"> · falta {(t.planejado - t.executado).toLocaleString('pt-BR')} {t.unidade}</span>}
                  <span className="text-gray-400"> · em {fmtData(t.dataRef)}</span>
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Histórico */}
      {avancos.length > 0 && (
        <details>
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Histórico de medições ({avancos.length})</summary>
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 text-gray-500">
                <th className="text-left font-semibold px-3 py-2">Data</th>
                <th className="text-left font-semibold px-3 py-2">Trecho</th>
                <th className="text-right font-semibold px-3 py-2">Planejado</th>
                <th className="text-right font-semibold px-3 py-2">Executado</th>
                <th className="text-left font-semibold px-3 py-2">Obs.</th>
                <th className="px-2 py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {avancos.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-1.5 text-gray-600">{fmtData(a.dataRef)}</td>
                    <td className="px-3 py-1.5 text-gray-800">{a.trecho}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{a.planejado.toLocaleString('pt-BR')} {a.unidade}</td>
                    <td className="px-3 py-1.5 text-right text-gray-800 font-medium">{a.executado.toLocaleString('pt-BR')} {a.unidade}</td>
                    <td className="px-3 py-1.5 text-gray-500">{a.observacao ?? '—'}</td>
                    <td className="px-2 py-1.5"><button onClick={() => delM.mutate(a.id)} title="Excluir lançamento" className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {avancos.length === 0 && !showForm && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          Nenhuma medição de avanço lançada. Lance o acumulado planejado × executado por trecho.
        </div>
      )}
    </div>
  )
}
