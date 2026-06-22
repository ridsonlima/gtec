'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Save, Trash2, Loader2, Plus, X, GraduationCap, CheckCircle2, AlertTriangle, Clock, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FotoCapture } from '@/components/funcionarios/FotoCapture'
import { EmpresaSelect } from '@/components/funcionarios/EmpresaSelect'
import { FuncaoSelect } from '@/components/funcionarios/FuncaoSelect'
import {
  TREINAMENTOS_PADRAO, statusTreinamento, TREINAMENTO_STATUS_META, type TreinamentoStatus,
} from '@/lib/funcionarios'

interface Treino { id: string; nome: string; realizadoEm: string | null; validade: string | null; observacao: string | null }
interface Contrato { id: string; number: string; name: string }
interface Func {
  id: string; nome: string; cpf: string | null; matricula: string | null; cargo: string | null
  fotoUrl: string | null; empresa: string | null; vinculo: string; situacao: string; regime: string
  alojado: boolean; alojamento: string | null; contrato: string | null; contratoId: string | null; ativo: boolean
  observacoes: string | null; treinamentos: Treino[]; contratoRef: Contrato | null
}

export default function FuncionarioDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['funcionario', params.id],
    queryFn: () => fetch(`/api/funcionarios/${params.id}`).then((r) => r.json()),
  })
  const f: Func | undefined = data?.data?.funcionario
  const contratos: Contrato[] = data?.data?.contratos ?? []

  const { data: funcoesData } = useQuery({
    queryKey: ['funcoes'],
    queryFn: () => fetch('/api/funcoes').then((r) => r.json()),
  })
  const funcoes: { nome: string; treinamentos: string[] }[] = funcoesData?.data ?? []

  const patchM = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/funcionarios/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funcionario', params.id] })
      qc.invalidateQueries({ queryKey: ['funcionarios'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/funcionarios/${params.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
    },
    onSuccess: () => router.push('/funcionarios'),
  })

  // Form local
  const [form, setForm] = useState<Partial<Func>>({})
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { if (f) setForm(f) }, [f?.id])

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
  }
  if (!f) return <p className="text-sm text-gray-400 py-12 text-center">Funcionário não encontrado.</p>

  const set = (k: keyof Func, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify({ ...f, treinamentos: undefined }) !== JSON.stringify({ ...f, ...form, treinamentos: undefined })

  function saveDados() {
    patchM.mutate({
      nome: form.nome, cpf: form.cpf || null, matricula: form.matricula || null, cargo: form.cargo || null,
      empresa: form.empresa || null, vinculo: form.vinculo, situacao: form.situacao, regime: form.regime,
      alojado: form.alojado, alojamento: form.alojamento || null, contrato: form.contrato || null,
      contratoId: form.contratoId || null,
      observacoes: form.observacoes || null,
    })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/funcionarios" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" /> Funcionários
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Foto */}
          <FotoCapture
            value={form.fotoUrl ?? null}
            onChange={(url) => { set('fotoUrl', url); patchM.mutate({ fotoUrl: url }) }}
            size={140}
          />

          {/* Dados principais */}
          <div className="flex-1 space-y-3">
            <Field label="Nome">
              <input value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} className="finput text-base font-semibold" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cargo / função"><FuncaoSelect value={form.cargo ?? ''} onChange={(v) => set('cargo', v)} className="finput" /></Field>
              <Field label="Empresa"><EmpresaSelect value={form.empresa ?? ''} onChange={(v) => set('empresa', v)} className="finput" /></Field>
              <Field label="CPF"><input value={form.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} className="finput" /></Field>
              <Field label="Matrícula"><input value={form.matricula ?? ''} onChange={(e) => set('matricula', e.target.value)} className="finput" /></Field>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          <Field label="Vínculo">
            <select value={form.vinculo} onChange={(e) => set('vinculo', e.target.value)} className="finput">
              <option value="proprio">Próprio</option><option value="terceirizado">Terceirizado</option>
            </select>
          </Field>
          <Field label="Situação">
            <select value={form.situacao} onChange={(e) => set('situacao', e.target.value)} className="finput">
              <option value="contratado">Contratado</option><option value="avulso">Avulso</option>
            </select>
          </Field>
          <Field label="Regime">
            <select value={form.regime} onChange={(e) => set('regime', e.target.value)} className="finput">
              <option value="diaria">Diária</option><option value="clt">CLT</option><option value="pj">PJ</option>
            </select>
          </Field>
          <Field label="Alojado?">
            <select value={form.alojado ? 'true' : 'false'} onChange={(e) => set('alojado', e.target.value === 'true')} className="finput">
              <option value="false">Não</option><option value="true">Sim</option>
            </select>
          </Field>
          {form.alojado && (
            <Field label="Alojamento (local)"><input value={form.alojamento ?? ''} onChange={(e) => set('alojamento', e.target.value)} className="finput" placeholder="Ex.: Alojamento B - Quarto 3" /></Field>
          )}
          <Field label="Alocação (contrato)" className="col-span-2 sm:col-span-1">
            <select value={form.contratoId ?? ''} onChange={(e) => set('contratoId', e.target.value || null)} className="finput">
              <option value="">Sem alocação</option>
              {contratos.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Observações" className="mt-3">
          <textarea value={form.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} rows={2} className="finput resize-none" />
        </Field>

        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => patchM.mutate({ ativo: !f.ativo })}
              className={cn('text-xs px-3 py-1.5 rounded-lg font-medium', f.ativo ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100')}
            >
              {f.ativo ? 'Inativar' : 'Reativar'}
            </button>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium', f.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {f.ativo ? 'Ativo' : 'Inativo'}
            </span>
            {confirmDel ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-gray-600">Excluir definitivamente?</span>
                <button onClick={() => deleteM.mutate()} disabled={deleteM.isPending} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">Sim, excluir</button>
                <button onClick={() => setConfirmDel(false)} className="px-2 py-1.5 text-gray-500">Cancelar</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium text-red-600 bg-red-50 hover:bg-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            )}
          </div>
          <button
            onClick={saveDados}
            disabled={!dirty || patchM.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {patchM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar dados
          </button>
        </div>
      </div>

      {/* Treinamentos */}
      <TreinamentosPanel
        funcionarioId={params.id}
        treinamentos={f.treinamentos}
        obrigatorios={funcoes.find((fn) => fn.nome === f.cargo)?.treinamentos ?? []}
        onChanged={() => qc.invalidateQueries({ queryKey: ['funcionario', params.id] })}
      />

      <style jsx global>{`
        .finput { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
        .finput:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
      `}</style>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block text-xs font-medium text-gray-600 space-y-1', className)}>
      <span>{label}</span>
      {children}
    </label>
  )
}

const STATUS_ICON: Record<TreinamentoStatus, React.ReactNode> = {
  ok: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  a_vencer: <Clock className="w-4 h-4 text-amber-500" />,
  vencido: <AlertTriangle className="w-4 h-4 text-red-500" />,
  pendente: <Circle className="w-4 h-4 text-gray-300" />,
}
const STATUS_CLS: Record<string, string> = {
  green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700', gray: 'bg-gray-100 text-gray-500',
}

function TreinamentosPanel({ funcionarioId, treinamentos, obrigatorios = [], onChanged }: {
  funcionarioId: string; treinamentos: Treino[]; obrigatorios?: string[]; onChanged: () => void
}) {
  const [novoNome, setNovoNome] = useState('')
  const { data: catData } = useQuery({ queryKey: ['treinamentos'], queryFn: () => fetch('/api/treinamentos').then((r) => r.json()) })
  const catalogo: { nome: string; descricao?: string | null }[] = catData?.data ?? TREINAMENTOS_PADRAO
  const descMap = new Map(catalogo.map((c) => [c.nome.toUpperCase(), c.descricao ?? null]))

  const obrigSet = new Set(obrigatorios.map((n) => n.toUpperCase()))

  // Combina: treinamentos exigidos pela função + catálogo + já existentes (customizados)
  const existentesPorNome = new Map(treinamentos.map((t) => [t.nome.toUpperCase(), t]))
  const vistos = new Set<string>()
  const linhas: { nome: string; registro: Treino | null; obrigatorio: boolean }[] = []
  const push = (nome: string) => {
    const key = nome.toUpperCase()
    if (vistos.has(key)) return
    vistos.add(key)
    linhas.push({ nome, registro: existentesPorNome.get(key) ?? null, obrigatorio: obrigSet.has(key) })
  }
  // 1) exigidos pela função primeiro
  for (const n of obrigatorios) push(n)
  // 2) catálogo gerenciável
  for (const p of catalogo) push(p.nome)
  // 3) demais já registrados (customizados)
  for (const t of treinamentos) push(t.nome)

  const pendentesObrig = obrigatorios.filter((n) => {
    const r = existentesPorNome.get(n.toUpperCase())
    return !r || !r.realizadoEm
  }).length

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <GraduationCap className="w-4 h-4" /> Treinamentos
      </h2>
      <p className="text-xs text-gray-400 -mt-1">Marque a data de realização e a validade. O sistema sinaliza vencidos e a vencer.</p>
      {obrigatorios.length > 0 && (
        <div className={`text-xs px-3 py-2 rounded-lg ${pendentesObrig > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {pendentesObrig > 0
            ? `⚠️ Esta função exige ${obrigatorios.length} treinamento(s) — ${pendentesObrig} ainda não realizado(s).`
            : `✅ Todos os ${obrigatorios.length} treinamentos exigidos pela função foram realizados.`}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {linhas.map((l) => (
          <TreinoRow key={l.nome} funcionarioId={funcionarioId} nome={l.nome} descricao={descMap.get(l.nome.toUpperCase()) ?? null} registro={l.registro} obrigatorio={l.obrigatorio} onChanged={onChanged} />
        ))}
      </div>

      {/* Adicionar treinamento customizado */}
      <div className="flex items-center gap-2 pt-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Adicionar outro treinamento (ex.: Primeiros Socorros)"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>
      {novoNome.trim() && (
        <TreinoRow funcionarioId={funcionarioId} nome={novoNome.trim()} registro={null} onChanged={() => { setNovoNome(''); onChanged() }} forceEdit />
      )}
    </div>
  )
}

function TreinoRow({ funcionarioId, nome, descricao, registro, onChanged, forceEdit, obrigatorio }: {
  funcionarioId: string; nome: string; descricao?: string | null; registro: Treino | null; onChanged: () => void; forceEdit?: boolean; obrigatorio?: boolean
}) {
  const toInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '')
  const [realizado, setRealizado] = useState(toInput(registro?.realizadoEm))
  const [validade, setValidade]   = useState(toInput(registro?.validade))

  const status = statusTreinamento(registro?.realizadoEm, registro?.validade)
  const meta = TREINAMENTO_STATUS_META[status]

  const saveM = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/funcionarios/${funcionarioId}/treinamentos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treinamentoId: registro?.id,
          nome,
          realizadoEm: realizado ? new Date(realizado + 'T12:00:00').toISOString() : null,
          validade: validade ? new Date(validade + 'T12:00:00').toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar treinamento')
    },
    onSuccess: onChanged,
  })

  const delM = useMutation({
    mutationFn: async () => {
      if (!registro?.id) return
      await fetch(`/api/funcionarios/${funcionarioId}/treinamentos`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treinamentoId: registro.id }),
      })
    },
    onSuccess: onChanged,
  })

  const changed = realizado !== toInput(registro?.realizadoEm) || validade !== toInput(registro?.validade)

  return (
    <div className="py-2.5 flex flex-wrap items-center gap-2">
      <div className="flex items-start gap-2 min-w-[180px] flex-1">
        <div className="mt-0.5">{STATUS_ICON[status]}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{nome}</span>
            {obrigatorio && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">Necessário</span>}
            {!forceEdit && <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium', STATUS_CLS[meta.color])}>{meta.label}</span>}
          </div>
          {descricao && <p className="text-xs text-gray-400 leading-snug mt-0.5">{descricao}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-gray-400">Feito
          <input type="date" value={realizado} onChange={(e) => setRealizado(e.target.value)} className="block text-xs border border-gray-200 rounded-md px-2 py-1" />
        </label>
        <label className="text-[11px] text-gray-400">Validade
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="block text-xs border border-gray-200 rounded-md px-2 py-1" />
        </label>
        {(changed || forceEdit) && (
          <button onClick={() => saveM.mutate()} disabled={saveM.isPending} title="Salvar" className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 self-end">
            {saveM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </button>
        )}
        {registro?.id && !changed && (
          <button onClick={() => delM.mutate()} title="Remover" className="p-1.5 text-gray-300 hover:text-red-500 self-end"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  )
}
