'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, X, Plus, Trash2, Save, Loader2, Pencil } from 'lucide-react'

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const TURNOS = ['Manhã', 'Tarde', 'Noite']
const LESOES = ['Cabeça/Face', 'Coluna/Tronco', 'Braço/Cotovelo', 'Mãos/Dedos', 'Joelho/Perna', 'Pé/Tornozelo', 'Outros']
const SITUACOES = ['Investigado', 'Pendente']
const TIPOS = ['Típico', 'Trajeto']

type Tab = 'indicadores' | 'acidentes' | 'taxas'

export function GerenciarDadosSeguranca() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('indicadores')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        <Settings2 className="w-4 h-4" /> Gerenciar dados
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Gerenciar dados — Segurança 2026</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-1 px-5 pt-3">
              {([['indicadores', 'Indicadores'], ['acidentes', 'Acidentes'], ['taxas', 'Taxas mensais']] as [Tab, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg ${tab === k ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'indicadores' && <IndicadoresTab />}
              {tab === 'acidentes' && <AcidentesTab />}
              {tab === 'taxas' && <TaxasTab />}
            </div>
          </div>
          <style jsx global>{`
            .seg-input { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
            .seg-input:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
          `}</style>
        </div>
      )}
    </>
  )
}

function useInvalidateDashboard() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['seguranca-dashboard'] })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-600 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  )
}

// ─── Indicadores (config) ─────────────────────────────────────────────────────

function IndicadoresTab() {
  const qc = useQueryClient()
  const invalidateDash = useInvalidateDashboard()
  const { data, isLoading } = useQuery({ queryKey: ['seg-config'], queryFn: () => fetch('/api/seguranca/config').then((r) => r.json()) })
  const cfg = data?.data

  const [form, setForm] = useState<Record<string, any>>({})
  useEffect(() => {
    setForm({
      diasSemAcidentes: cfg?.diasSemAcidentes ?? 0,
      treinamentosConforme: cfg?.treinamentosConforme ?? 0,
      treinamentosNecessitam: cfg?.treinamentosNecessitam ?? 0,
      totalCustos: cfg?.totalCustos ?? 0,
      inspecaoSeguranca: cfg?.inspecaoSeguranca ?? 0,
      dssRealizados: cfg?.dssRealizados ?? 0,
      mesReferencia: cfg?.mesReferencia ?? 'ATUAL',
    })
  }, [cfg])

  const saveM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/seguranca/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diasSemAcidentes: Number(form.diasSemAcidentes) || 0,
          treinamentosConforme: Number(form.treinamentosConforme) || 0,
          treinamentosNecessitam: Number(form.treinamentosNecessitam) || 0,
          totalCustos: Number(form.totalCustos) || 0,
          inspecaoSeguranca: Number(form.inspecaoSeguranca) || 0,
          dssRealizados: Number(form.dssRealizados) || 0,
          mesReferencia: String(form.mesReferencia || 'ATUAL'),
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seg-config'] }); invalidateDash() },
  })

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Dias sem acidentes"><input type="number" value={form.diasSemAcidentes} onChange={(e) => set('diasSemAcidentes', e.target.value)} className="seg-input" /></Field>
        <Field label="Treinamentos conforme"><input type="number" value={form.treinamentosConforme} onChange={(e) => set('treinamentosConforme', e.target.value)} className="seg-input" /></Field>
        <Field label="Necessitam treinamento"><input type="number" value={form.treinamentosNecessitam} onChange={(e) => set('treinamentosNecessitam', e.target.value)} className="seg-input" /></Field>
        <Field label="Total de custos (R$)"><input type="number" step="0.01" value={form.totalCustos} onChange={(e) => set('totalCustos', e.target.value)} className="seg-input" /></Field>
        <Field label="Inspeções de segurança"><input type="number" value={form.inspecaoSeguranca} onChange={(e) => set('inspecaoSeguranca', e.target.value)} className="seg-input" /></Field>
        <Field label="DSS realizados"><input type="number" value={form.dssRealizados} onChange={(e) => set('dssRealizados', e.target.value)} className="seg-input" /></Field>
        <Field label="Mês de referência">
          <select value={form.mesReferencia} onChange={(e) => set('mesReferencia', e.target.value)} className="seg-input">
            {['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-xs text-gray-400">Os totais de acidentes, turno, situação, mês e lesões são calculados automaticamente a partir dos acidentes registrados na aba ao lado.</p>
      <div className="flex justify-end">
        <button onClick={() => saveM.mutate()} disabled={saveM.isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saveM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar indicadores
        </button>
      </div>
    </div>
  )
}

// ─── Acidentes ────────────────────────────────────────────────────────────────

const emptyAcidente = {
  nome: '', cargo: '', dataOcorrencia: '', turno: 'Manhã', areaLesionada: 'Mãos/Dedos',
  situacaoInvestigacao: 'Pendente', tipoAcidente: 'Típico', afastamento: 'ASA',
  diasPerdidos: 0, valoresGastos: 0, agenteCausador: '',
}

function AcidentesTab() {
  const qc = useQueryClient()
  const invalidateDash = useInvalidateDashboard()
  const { data, isLoading } = useQuery({ queryKey: ['seg-acidentes'], queryFn: () => fetch('/api/seguranca/acidentes').then((r) => r.json()) })
  const acidentes: any[] = data?.data ?? []

  const [editing, setEditing] = useState<any | null>(null)

  const refresh = () => { qc.invalidateQueries({ queryKey: ['seg-acidentes'] }); invalidateDash() }

  const saveM = useMutation({
    mutationFn: async (a: any) => {
      const payload = {
        nome: a.nome.trim(), cargo: a.cargo || null, dataOcorrencia: a.dataOcorrencia,
        turno: a.turno || null, areaLesionada: a.areaLesionada || null,
        situacaoInvestigacao: a.situacaoInvestigacao || null, tipoAcidente: a.tipoAcidente,
        afastamento: a.afastamento, diasPerdidos: Number(a.diasPerdidos) || 0,
        valoresGastos: a.valoresGastos ? Number(a.valoresGastos) : null, agenteCausador: a.agenteCausador || null,
      }
      const res = a.id
        ? await fetch(`/api/seguranca/acidentes/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/seguranca/acidentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Erro ao salvar acidente')
    },
    onSuccess: () => { setEditing(null); refresh() },
  })

  const delM = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/seguranca/acidentes/${id}`, { method: 'DELETE' }) },
    onSuccess: refresh,
  })

  if (isLoading) return <Loading />

  return (
    <div className="space-y-3">
      {!editing && (
        <button onClick={() => setEditing({ ...emptyAcidente })} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Registrar acidente
        </button>
      )}

      {editing && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Nome *"><input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className="seg-input" /></Field>
            <Field label="Cargo"><input value={editing.cargo ?? ''} onChange={(e) => setEditing({ ...editing, cargo: e.target.value })} className="seg-input" /></Field>
            <Field label="Data *"><input type="date" value={editing.dataOcorrencia?.slice(0, 10) ?? ''} onChange={(e) => setEditing({ ...editing, dataOcorrencia: e.target.value })} className="seg-input" /></Field>
            <Field label="Turno">
              <select value={editing.turno ?? ''} onChange={(e) => setEditing({ ...editing, turno: e.target.value })} className="seg-input">{TURNOS.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Parte lesionada">
              <select value={editing.areaLesionada ?? ''} onChange={(e) => setEditing({ ...editing, areaLesionada: e.target.value })} className="seg-input">{LESOES.map((l) => <option key={l}>{l}</option>)}</select>
            </Field>
            <Field label="Situação">
              <select value={editing.situacaoInvestigacao ?? ''} onChange={(e) => setEditing({ ...editing, situacaoInvestigacao: e.target.value })} className="seg-input">{SITUACOES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Tipo">
              <select value={editing.tipoAcidente} onChange={(e) => setEditing({ ...editing, tipoAcidente: e.target.value })} className="seg-input">{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Afastamento">
              <select value={editing.afastamento} onChange={(e) => setEditing({ ...editing, afastamento: e.target.value })} className="seg-input">
                <option value="ASA">Sem afastamento (ASA)</option>
                <option value="ACA">Com afastamento (ACA)</option>
              </select>
            </Field>
            <Field label="Dias perdidos"><input type="number" value={editing.diasPerdidos ?? 0} onChange={(e) => setEditing({ ...editing, diasPerdidos: e.target.value })} className="seg-input" /></Field>
            <Field label="Custos (R$)"><input type="number" step="0.01" value={editing.valoresGastos ?? 0} onChange={(e) => setEditing({ ...editing, valoresGastos: e.target.value })} className="seg-input" /></Field>
            <Field label="Agente causador"><input value={editing.agenteCausador ?? ''} onChange={(e) => setEditing({ ...editing, agenteCausador: e.target.value })} className="seg-input" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            <button onClick={() => saveM.mutate(editing)} disabled={saveM.isPending || !editing.nome?.trim() || !editing.dataOcorrencia} className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saveM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </button>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
            <th className="text-left font-semibold px-3 py-2">Nome</th>
            <th className="text-left font-semibold px-3 py-2">Data</th>
            <th className="text-left font-semibold px-3 py-2">Turno</th>
            <th className="text-left font-semibold px-3 py-2">Lesão</th>
            <th className="text-left font-semibold px-3 py-2">Situação</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {acidentes.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-xs">Nenhum acidente registrado.</td></tr>}
            {acidentes.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{a.nome}</td>
                <td className="px-3 py-2 text-gray-600">{new Date(a.dataOcorrencia).toLocaleDateString('pt-BR')}</td>
                <td className="px-3 py-2 text-gray-600">{a.turno ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{a.areaLesionada ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{a.situacaoInvestigacao ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setEditing({ ...a })} className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => delM.mutate(a.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Taxas mensais ────────────────────────────────────────────────────────────

type TaxaDraft = { hht: string; comAf: string; semAf: string; diasPerd: string; diasDeb: string }

function calcTF(hht: number, comAf: number) { return hht > 0 ? Math.round((comAf * 1_000_000 / hht) * 100) / 100 : 0 }
function calcTG(hht: number, diasPerd: number, diasDeb: number) { return hht > 0 ? Math.round(((diasPerd + diasDeb) * 1_000_000 / hht) * 100) / 100 : 0 }

function TaxasTab() {
  const qc = useQueryClient()
  const invalidateDash = useInvalidateDashboard()
  const { data, isLoading } = useQuery({ queryKey: ['seg-taxas'], queryFn: () => fetch('/api/seguranca/taxas').then((r) => r.json()) })
  const taxas: any[] = data?.data ?? []

  const byMes = new Map(taxas.map((t) => [t.mes, t]))
  const [drafts, setDrafts] = useState<Record<string, TaxaDraft>>({})

  const draftFor = (mes: string): TaxaDraft => {
    if (drafts[mes]) return drafts[mes]
    const ex = byMes.get(mes)
    return {
      hht:      ex?.totalHorasTrabalhadas ? String(ex.totalHorasTrabalhadas) : '',
      comAf:    ex?.acidentesComAfastamento ? String(ex.acidentesComAfastamento) : '',
      semAf:    ex?.acidentesSemAfastamento ? String(ex.acidentesSemAfastamento) : '',
      diasPerd: ex?.diasPerdidos ? String(ex.diasPerdidos) : '',
      diasDeb:  ex?.diasDebitados ? String(ex.diasDebitados) : '',
    }
  }

  const saveM = useMutation({
    mutationFn: async (mes: string) => {
      const d = draftFor(mes)
      const res = await fetch('/api/seguranca/taxas', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes,
          totalHorasTrabalhadas:   Number(d.hht) || 0,
          acidentesComAfastamento: Number(d.comAf) || 0,
          acidentesSemAfastamento: Number(d.semAf) || 0,
          diasPerdidos:            Number(d.diasPerd) || 0,
          diasDebitados:           Number(d.diasDeb) || 0,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar taxa')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seg-taxas'] }); invalidateDash() },
  })

  if (isLoading) return <Loading />

  return (
    <div className="space-y-2">
      <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs px-3 py-2 rounded-lg leading-relaxed">
        <p className="font-semibold mb-0.5">Como o sistema calcula (NBR 14280)</p>
        <p><strong>TF</strong> = (acidentes <em>com</em> afastamento × 1.000.000) ÷ horas-homem trabalhadas (HHT)</p>
        <p><strong>TG</strong> = ((dias perdidos + dias debitados) × 1.000.000) ÷ HHT</p>
        <p className="mt-0.5 text-blue-600">Preencha HHT e os números do mês — TF e TG são calculados automaticamente.</p>
      </div>
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="bg-gray-50 text-gray-500 text-[11px] uppercase">
            <th className="text-left font-semibold px-2 py-2">Mês</th>
            <th className="text-left font-semibold px-2 py-2">HHT</th>
            <th className="text-left font-semibold px-2 py-2">Ac. c/ afast.</th>
            <th className="text-left font-semibold px-2 py-2">Ac. s/ afast.</th>
            <th className="text-left font-semibold px-2 py-2">Dias perd.</th>
            <th className="text-left font-semibold px-2 py-2">Dias deb.</th>
            <th className="text-right font-semibold px-2 py-2">TF</th>
            <th className="text-right font-semibold px-2 py-2">TG</th>
            <th className="px-2 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {MESES.map((mes) => {
              const d = draftFor(mes)
              const upd = (patch: Partial<TaxaDraft>) => setDrafts((p) => ({ ...p, [mes]: { ...d, ...patch } }))
              const hht = Number(d.hht) || 0
              const tf = calcTF(hht, Number(d.comAf) || 0)
              const tg = calcTG(hht, Number(d.diasPerd) || 0, Number(d.diasDeb) || 0)
              const num = 'seg-input !px-2 !py-1 max-w-[84px] text-right'
              return (
                <tr key={mes} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 font-medium text-gray-700">{mes}</td>
                  <td className="px-2 py-1.5"><input type="number" value={d.hht} onChange={(e) => upd({ hht: e.target.value })} className={num} placeholder="0" /></td>
                  <td className="px-2 py-1.5"><input type="number" value={d.comAf} onChange={(e) => upd({ comAf: e.target.value })} className={num} placeholder="0" /></td>
                  <td className="px-2 py-1.5"><input type="number" value={d.semAf} onChange={(e) => upd({ semAf: e.target.value })} className={num} placeholder="0" /></td>
                  <td className="px-2 py-1.5"><input type="number" value={d.diasPerd} onChange={(e) => upd({ diasPerd: e.target.value })} className={num} placeholder="0" /></td>
                  <td className="px-2 py-1.5"><input type="number" value={d.diasDeb} onChange={(e) => upd({ diasDeb: e.target.value })} className={num} placeholder="0" /></td>
                  <td className="px-2 py-1.5 text-right font-bold text-amber-700">{tf.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-gray-700">{tg.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => saveM.mutate(mes)} disabled={saveM.isPending} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
                      <Save className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Loading() {
  return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
}
