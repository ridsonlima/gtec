'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserCog, Receipt, FileText, ClipboardCheck, Plus, X, Loader2, CheckCircle2,
  AlertTriangle, ShieldCheck, Camera, Trash2,
} from 'lucide-react'
import { FotoCapture } from '@/components/funcionarios/FotoCapture'

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
const fmtBRL = (v: number | null) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const hoje = () => new Date().toISOString().slice(0, 10)
const PODE_APROVAR = ['master', 'admin', 'director', 'manager', 'supervisor']

const MULTA_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  pago: { label: 'Paga', cls: 'bg-green-50 text-green-700' },
  recorrido: { label: 'Recorrida', cls: 'bg-blue-50 text-blue-700' },
  indicado: { label: 'Condutor indicado', cls: 'bg-violet-50 text-violet-700' },
}
const DOC_LABEL: Record<string, string> = { seguro: 'Seguro', ipva: 'IPVA', licenciamento: 'Licenciamento', outro: 'Outro' }

const ROTEIRO = [
  { key: 'frente', label: 'Frente', hint: 'Foto frontal do veículo, com placa visível.' },
  { key: 'traseira', label: 'Traseira', hint: 'Foto traseira, com placa visível.' },
  { key: 'lateral_esq', label: 'Lateral esquerda', hint: 'Lateral do motorista, inteira.' },
  { key: 'lateral_dir', label: 'Lateral direita', hint: 'Lateral do passageiro, inteira.' },
  { key: 'painel', label: 'Painel / Odômetro', hint: 'Painel ligado mostrando a quilometragem.' },
  { key: 'interior', label: 'Interior', hint: 'Bancos e estado interno.' },
  { key: 'pneus', label: 'Pneus / Estepe', hint: 'Estado dos pneus e do estepe.' },
  { key: 'avarias', label: 'Avarias (se houver)', hint: 'Registre qualquer dano existente.' },
]

type Sub = 'condutor' | 'docs' | 'checklist'

export function VeiculoGestaoPanel({ ativoId }: { ativoId: string }) {
  const [sub, setSub] = useState<Sub>('condutor')
  const { data, isLoading } = useQuery({ queryKey: ['veiculo', ativoId], queryFn: () => fetch(`/api/frota/ativos/${ativoId}/veiculo`).then((r) => r.json()) })
  const d = data?.data

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><UserCog className="w-4 h-4" /> Gestão do veículo</h2>
      <div className="flex gap-1 border-b border-gray-200">
        {([['condutor', 'Condutor & Multas', <Receipt key="i" className="w-4 h-4" />], ['docs', 'Documentos', <FileText key="i" className="w-4 h-4" />], ['checklist', 'Checklists', <ClipboardCheck key="i" className="w-4 h-4" />]] as [Sub, string, React.ReactNode][]).map(([k, label, icon]) => (
          <button key={k} onClick={() => setSub(k)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${sub === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {isLoading || !d ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          {sub === 'condutor' && <CondutorMultas ativoId={ativoId} d={d} />}
          {sub === 'docs' && <Documentos ativoId={ativoId} documentos={d.documentos} />}
          {sub === 'checklist' && <Checklists ativoId={ativoId} checklists={d.checklists} />}
        </>
      )}
      <style jsx global>{`
        .vinput { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
        .vinput:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
      `}</style>
    </section>
  )
}

function CondutorMultas({ ativoId, d }: { ativoId: string; d: any }) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['veiculo', ativoId] })
  const [showForm, setShowForm] = useState(false)
  const [m, setM] = useState({ dataInfracao: hoje(), infracao: '', local: '', valor: '', pontos: '', vencimento: '', condutorId: '', status: 'pendente' })

  const setCondutorM = useMutation({
    mutationFn: async (condutorId: string) => { await fetch(`/api/frota/ativos/${ativoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ condutorAtualId: condutorId || null }) }) },
    onSuccess: refresh,
  })
  const createMulta = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/veiculos/multas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativoId, dataInfracao: new Date(m.dataInfracao + 'T12:00:00').toISOString(), infracao: m.infracao, local: m.local || null, valor: m.valor ? Number(m.valor) : null, pontos: m.pontos ? Number(m.pontos) : null, vencimento: m.vencimento || null, condutorId: m.condutorId || null, status: m.status }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setM({ dataInfracao: hoje(), infracao: '', local: '', valor: '', pontos: '', vencimento: '', condutorId: '', status: 'pendente' }); refresh() },
  })
  const patchMulta = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => { await fetch(`/api/veiculos/multas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) },
    onSuccess: refresh,
  })
  const delMulta = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/veiculos/multas/${id}`, { method: 'DELETE' }) },
    onSuccess: refresh,
  })

  return (
    <div className="space-y-4">
      {/* Condutor atual */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Condutor atual do veículo (para identificar responsável por multas)</span>
          <select value={d.condutorAtualId ?? ''} onChange={(e) => setCondutorM.mutate(e.target.value)} className="vinput max-w-md">
            <option value="">Sem condutor atribuído</option>
            {d.condutores.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      {/* Multas */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Multas ({d.multas.length})</h3>
        {!showForm && <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"><Plus className="w-3.5 h-3.5" /> Nova multa</button>}
      </div>

      {showForm && (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
          <textarea value={m.infracao} onChange={(e) => setM({ ...m, infracao: e.target.value })} rows={2} className="vinput resize-none" placeholder="Infração (ex.: Excesso de velocidade na via X)" autoFocus />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block text-xs text-gray-600 space-y-1"><span>Data</span><input type="date" value={m.dataInfracao} onChange={(e) => setM({ ...m, dataInfracao: e.target.value })} className="vinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Vencimento</span><input type="date" value={m.vencimento} onChange={(e) => setM({ ...m, vencimento: e.target.value })} className="vinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Valor (R$)</span><input type="number" step="0.01" value={m.valor} onChange={(e) => setM({ ...m, valor: e.target.value })} className="vinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Pontos</span><input type="number" value={m.pontos} onChange={(e) => setM({ ...m, pontos: e.target.value })} className="vinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Condutor</span>
              <select value={m.condutorId} onChange={(e) => setM({ ...m, condutorId: e.target.value })} className="vinput">
                <option value="">Condutor atual</option>
                {d.condutores.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Status</span>
              <select value={m.status} onChange={(e) => setM({ ...m, status: e.target.value })} className="vinput">
                {Object.entries(MULTA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          </div>
          <input value={m.local} onChange={(e) => setM({ ...m, local: e.target.value })} className="vinput" placeholder="Local (opcional)" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createMulta.mutate()} disabled={createMulta.isPending || !m.infracao.trim()} className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createMulta.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {d.multas.length === 0 && !showForm && <p className="text-sm text-gray-400">Nenhuma multa registrada.</p>}
        {d.multas.map((mu: any) => {
          const meta = MULTA_STATUS[mu.status] ?? MULTA_STATUS.pendente
          return (
            <div key={mu.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{mu.infracao}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmt(mu.dataInfracao)} · {mu.condutor ? mu.condutor.nome : 'Sem condutor'} · {fmtBRL(mu.valor)}
                    {mu.pontos != null && ` · ${mu.pontos} pts`}{mu.vencimento && ` · vence ${fmt(mu.vencimento)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select value={mu.status} onChange={(e) => patchMulta.mutate({ id: mu.id, body: { status: e.target.value } })} className={`text-[11px] font-medium px-1.5 py-1 rounded border-0 ${meta.cls}`}>
                    {Object.entries(MULTA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={() => delMulta.mutate(mu.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Documentos({ ativoId, documentos }: { ativoId: string; documentos: any[] }) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['veiculo', ativoId] })
  const [showForm, setShowForm] = useState(false)
  const [doc, setDoc] = useState({ tipo: 'seguro', descricao: '', valor: '', vencimento: '' })

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/veiculos/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativoId, tipo: doc.tipo, descricao: doc.descricao || null, valor: doc.valor ? Number(doc.valor) : null, vencimento: doc.vencimento || null }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setDoc({ tipo: 'seguro', descricao: '', valor: '', vencimento: '' }); refresh() },
  })
  const delM = useMutation({ mutationFn: async (id: string) => { await fetch(`/api/veiculos/documentos/${id}`, { method: 'DELETE' }) }, onSuccess: refresh })

  return (
    <div className="space-y-3">
      {!showForm && <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"><Plus className="w-3.5 h-3.5" /> Novo documento</button>}
      {showForm && (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block text-xs text-gray-600 space-y-1"><span>Tipo</span>
              <select value={doc.tipo} onChange={(e) => setDoc({ ...doc, tipo: e.target.value })} className="vinput">
                {Object.entries(DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="block text-xs text-gray-600 space-y-1 col-span-2 sm:col-span-1"><span>Descrição</span><input value={doc.descricao} onChange={(e) => setDoc({ ...doc, descricao: e.target.value })} className="vinput" placeholder="Seguradora / apólice" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Valor (R$)</span><input type="number" step="0.01" value={doc.valor} onChange={(e) => setDoc({ ...doc, valor: e.target.value })} className="vinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Vencimento</span><input type="date" value={doc.vencimento} onChange={(e) => setDoc({ ...doc, vencimento: e.target.value })} className="vinput" /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createM.mutate()} disabled={createM.isPending} className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">{createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {documentos.length === 0 && !showForm && <p className="text-sm text-gray-400">Nenhum documento (seguro, IPVA…) cadastrado.</p>}
        {documentos.map((doc: any) => {
          const venc = doc.vencimento ? new Date(doc.vencimento) : null
          const dias = venc ? Math.ceil((venc.getTime() - Date.now()) / 86400000) : null
          const vencido = dias !== null && dias < 0
          const aVencer = dias !== null && dias >= 0 && dias <= 30
          return (
            <div key={doc.id} className={`bg-white border rounded-xl p-3 flex items-center justify-between gap-2 ${vencido ? 'border-l-4 border-l-red-500 border-gray-200' : aVencer ? 'border-l-4 border-l-amber-400 border-gray-200' : 'border-gray-200'}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{DOC_LABEL[doc.tipo]}{doc.descricao && <span className="font-normal text-gray-500"> · {doc.descricao}</span>}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtBRL(doc.valor)}{venc && <> · vence {fmt(doc.vencimento)}</>}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {vencido ? <span className="text-[11px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full">Vencido</span>
                  : aVencer ? <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">vence em {dias}d</span>
                  : venc ? <span className="text-[11px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">Vigente</span> : null}
                <button onClick={() => delM.mutate(doc.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Checklists({ ativoId, checklists }: { ativoId: string; checklists: any[] }) {
  const qc = useQueryClient()
  const router = useRouter()
  const { data: session } = useSession()
  const podeAprovar = session?.user && PODE_APROVAR.includes((session.user as any).role)
  const refresh = () => qc.invalidateQueries({ queryKey: ['veiculo', ativoId] })

  const [showForm, setShowForm] = useState(false)
  const [km, setKm] = useState('')
  const [obs, setObs] = useState('')
  const [fotos, setFotos] = useState<Record<string, string | null>>({})

  const createM = useMutation({
    mutationFn: async () => {
      const fotoList = Object.entries(fotos).filter(([, url]) => url).map(([item, url]) => ({ item, fotoUrl: url as string }))
      const res = await fetch('/api/veiculos/checklists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativoId, km: km ? Number(km) : null, observacoes: obs || null, fotos: fotoList }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setKm(''); setObs(''); setFotos({}); refresh() },
  })
  const aprovarM = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: string; motivo?: string }) => {
      await fetch(`/api/veiculos/checklists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, motivoReprovacao: motivo ?? null }) })
    },
    onSuccess: refresh,
  })

  return (
    <div className="space-y-3">
      {!showForm && <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"><Plus className="w-3.5 h-3.5" /> Novo checklist</button>}

      {showForm && (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-4">
          <p className="text-xs text-blue-700">Tire as fotos seguindo o roteiro abaixo (pelo celular). Após enviar, o supervisor aprova para liberar o veículo.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ROTEIRO.map((r) => (
              <div key={r.key} className="bg-white rounded-lg border border-gray-200 p-2 flex flex-col items-center gap-1">
                <p className="text-xs font-semibold text-gray-700 text-center">{r.label}</p>
                <p className="text-[10px] text-gray-400 text-center leading-tight min-h-[26px]">{r.hint}</p>
                <FotoCapture value={fotos[r.key] ?? null} onChange={(url) => setFotos((p) => ({ ...p, [r.key]: url }))} size={96} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-gray-600 space-y-1"><span>KM atual</span><input type="number" value={km} onChange={(e) => setKm(e.target.value)} className="vinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Observações</span><input value={obs} onChange={(e) => setObs(e.target.value)} className="vinput" /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createM.mutate()} disabled={createM.isPending} className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Enviar checklist
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {checklists.length === 0 && !showForm && <p className="text-sm text-gray-400">Nenhum checklist registrado.</p>}
        {checklists.map((c: any) => {
          const meta = c.status === 'aprovado' ? { cls: 'bg-green-50 text-green-700 border-green-200', icon: <ShieldCheck className="w-3.5 h-3.5" />, label: 'Liberado' }
            : c.status === 'reprovado' ? { cls: 'bg-red-50 text-red-700 border-red-200', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Reprovado' }
            : { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Loader2 className="w-3.5 h-3.5" />, label: 'Aguardando aprovação' }
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${meta.cls}`}>{meta.icon} {meta.label}</span>
                  <p className="text-xs text-gray-400 mt-1">
                    {fmt(c.createdAt)} · por {c.solicitante.name}{c.km != null && ` · ${c.km.toLocaleString('pt-BR')} km`} · {c.fotos.length} foto(s)
                    {c.aprovador && ` · ${c.status === 'aprovado' ? 'liberado' : 'reprovado'} por ${c.aprovador.name}`}
                  </p>
                  {c.observacoes && <p className="text-xs text-gray-500 mt-0.5">{c.observacoes}</p>}
                  {c.motivoReprovacao && <p className="text-xs text-red-600 mt-0.5">Motivo: {c.motivoReprovacao}</p>}
                </div>
                {c.status === 'pendente' && podeAprovar && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => aprovarM.mutate({ id: c.id, status: 'aprovado' })} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> Liberar</button>
                    <button onClick={() => { const motivo = prompt('Motivo da reprovação:'); if (motivo !== null) aprovarM.mutate({ id: c.id, status: 'reprovado', motivo }) }} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg"><X className="w-3.5 h-3.5" /> Reprovar</button>
                  </div>
                )}
              </div>
              {/* miniaturas */}
              {c.fotos.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {c.fotos.map((f: any) => (
                    <a key={f.id} href={f.fotoUrl} target="_blank" rel="noopener noreferrer" title={f.item} className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.fotoUrl} alt={f.item} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
