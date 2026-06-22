'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HardHat, Plus, Search, Users, Building2, BedDouble, AlertTriangle, X, Loader2, GraduationCap, Clock, ChevronRight, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canManageFuncionarios } from '@/lib/permissions'
import { FotoCapture } from '@/components/funcionarios/FotoCapture'
import { EmpresaSelect } from '@/components/funcionarios/EmpresaSelect'
import { GerenciarEmpresas } from '@/components/funcionarios/GerenciarEmpresas'
import { FuncaoSelect } from '@/components/funcionarios/FuncaoSelect'
import { GerenciarFuncoes } from '@/components/funcionarios/GerenciarFuncoes'
import { GerenciarTreinamentos } from '@/components/funcionarios/GerenciarTreinamentos'
import {
  VINCULO_LABEL, SITUACAO_LABEL, REGIME_LABEL, resumoTreinamentos,
} from '@/lib/funcionarios'

interface Contrato { id: string; number: string; name: string }
interface Func {
  id: string; nome: string; cargo: string | null; empresa: string | null
  fotoUrl: string | null; vinculo: string; situacao: string; regime: string
  alojado: boolean; ativo: boolean
  contratoRef: Contrato | null
  treinamentos: { realizadoEm: string | null; validade: string | null }[]
}

export default function FuncionariosPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const qc = useQueryClient()

  const [search, setSearch]     = useState('')
  const [fVinculo, setFVinculo] = useState('')
  const [fRegime, setFRegime]   = useState('')
  const [fAlojado, setFAlojado] = useState('')
  const [fContrato, setFContrato] = useState('')
  const [fStatus, setFStatus]   = useState('true') // 'true' ativos | 'false' inativos | 'all' todos
  const [showNew, setShowNew]   = useState(false)
  const [showEmpresas, setShowEmpresas] = useState(false)
  const [showFuncoes, setShowFuncoes] = useState(false)
  const [showTreinos, setShowTreinos] = useState(false)

  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (fVinculo) params.set('vinculo', fVinculo)
  if (fRegime) params.set('regime', fRegime)
  if (fAlojado) params.set('alojado', fAlojado)
  if (fContrato) params.set('contratoId', fContrato)
  params.set('ativo', fStatus)

  const { data, isLoading } = useQuery({
    queryKey: ['funcionarios', params.toString()],
    queryFn: () => fetch(`/api/funcionarios?${params.toString()}`).then((r) => r.json()),
  })

  const funcionarios: Func[] = data?.data?.funcionarios ?? []
  const contratos: Contrato[] = data?.data?.contratos ?? []
  const alertas: { totalVencidos: number; totalAVencer: number; funcionarios: { id: string; nome: string; fotoUrl: string | null; empresa: string | null; vencidos: number; aVencer: number }[] } =
    data?.data?.alertas ?? { totalVencidos: 0, totalAVencer: 0, funcionarios: [] }

  const kpis = useMemo(() => {
    let terc = 0, aloj = 0, criticos = 0
    for (const f of funcionarios) {
      if (f.vinculo === 'terceirizado') terc++
      if (f.alojado) aloj++
      const r = resumoTreinamentos(f.treinamentos)
      if (r.vencidos > 0) criticos++
    }
    return { total: funcionarios.length, terc, aloj, criticos }
  }, [funcionarios])

  if (session && !canManageFuncionarios(session as any)) {
    return <p className="text-sm text-gray-400 py-12 text-center">Você não tem acesso ao controle de funcionários.</p>
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <HardHat className="w-5 h-5 text-blue-600" /> Controle de Funcionários
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cadastro de mão de obra própria e terceirizada — empresa, regime, treinamentos, alojamento e foto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTreinos(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98]"
          >
            <GraduationCap className="w-4 h-4" /> Treinamentos
          </button>
          <button
            onClick={() => setShowFuncoes(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98]"
          >
            <Briefcase className="w-4 h-4" /> Funções
          </button>
          <button
            onClick={() => setShowEmpresas(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98]"
          >
            <Building2 className="w-4 h-4" /> Empresas
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Novo funcionário
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="w-4 h-4" />} label="Ativos" value={kpis.total} color="blue" />
        <KpiCard icon={<Building2 className="w-4 h-4" />} label="Terceirizados" value={kpis.terc} color="violet" />
        <KpiCard icon={<BedDouble className="w-4 h-4" />} label="Alojados" value={kpis.aloj} color="emerald" />
        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Treino vencido" value={kpis.criticos} color="red" />
      </div>

      {/* Alertas de treinamento — só visível na área de Segurança */}
      {alertas.funcionarios.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-white" />
            <h2 className="text-sm font-semibold text-white">Treinamentos — atenção da Segurança</h2>
            <span className="ml-auto flex items-center gap-1.5">
              {alertas.totalVencidos > 0 && (
                <span className="text-xs font-medium text-white bg-white/25 px-2 py-0.5 rounded-full">{alertas.totalVencidos} vencido(s)</span>
              )}
              {alertas.totalAVencer > 0 && (
                <span className="text-xs font-medium text-white bg-white/15 px-2 py-0.5 rounded-full">{alertas.totalAVencer} a vencer</span>
              )}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {alertas.funcionarios.map((a) => (
              <Link key={a.id} href={`/funcionarios/${a.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
                  {a.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.fotoUrl} alt={a.nome} className="w-full h-full object-cover" />
                  ) : <HardHat className="w-4 h-4 text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.nome}</p>
                  <p className="text-xs text-gray-500 truncate">{a.empresa || 'Sem empresa'}</p>
                </div>
                {a.vencidos > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" /> {a.vencidos} vencido(s)
                  </span>
                )}
                {a.aVencer > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    <Clock className="w-3 h-3" /> {a.aVencer} a vencer
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, CPF, cargo…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <select value={fVinculo} onChange={(e) => setFVinculo(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
          <option value="">Todos os vínculos</option>
          <option value="proprio">Próprio</option>
          <option value="terceirizado">Terceirizado</option>
        </select>
        <select value={fRegime} onChange={(e) => setFRegime(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
          <option value="">Todos os regimes</option>
          <option value="diaria">Diária</option>
          <option value="clt">CLT</option>
          <option value="pj">PJ</option>
        </select>
        <select value={fAlojado} onChange={(e) => setFAlojado(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
          <option value="">Alojamento (todos)</option>
          <option value="true">Alojados</option>
          <option value="false">Não alojados</option>
        </select>
        <select value={fContrato} onChange={(e) => setFContrato(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white max-w-[220px]">
          <option value="">Todos os contratos</option>
          {contratos.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.name}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="all">Todos (ativos + inativos)</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : funcionarios.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <HardHat className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">Nenhum funcionário encontrado</p>
          <p className="text-xs text-gray-400 mt-1">Cadastre o primeiro com o botão “Novo funcionário”.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left font-semibold px-4 py-3">Funcionário</th>
                <th className="text-left font-semibold px-4 py-3">Empresa</th>
                <th className="text-left font-semibold px-4 py-3">Vínculo</th>
                <th className="text-left font-semibold px-4 py-3">Regime</th>
                <th className="text-left font-semibold px-4 py-3">Contrato</th>
                <th className="text-left font-semibold px-4 py-3">Alojado</th>
                <th className="text-left font-semibold px-4 py-3">Treinamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funcionarios.map((f) => <FuncRow key={f.id} f={f} router={router} />)}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NovoFuncionarioModal
          contratos={contratos}
          onClose={() => setShowNew(false)}
          onCreated={(id) => { qc.invalidateQueries({ queryKey: ['funcionarios'] }); router.push(`/funcionarios/${id}`) }}
        />
      )}

      {showEmpresas && <GerenciarEmpresas onClose={() => setShowEmpresas(false)} />}
      {showFuncoes && <GerenciarFuncoes onClose={() => setShowFuncoes(false)} />}
      {showTreinos && <GerenciarTreinamentos onClose={() => setShowTreinos(false)} />}
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', colors[color])}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function FuncRow({ f, router }: { f: Func; router: ReturnType<typeof useRouter> }) {
  const r = resumoTreinamentos(f.treinamentos)
  const treinoBadge =
    r.vencidos > 0 ? { txt: `${r.vencidos} vencido(s)`, cls: 'bg-red-50 text-red-700' }
    : r.aVencer > 0 ? { txt: `${r.aVencer} a vencer`, cls: 'bg-amber-50 text-amber-700' }
    : r.total > 0 ? { txt: 'Em dia', cls: 'bg-green-50 text-green-700' }
    : { txt: 'Sem treino', cls: 'bg-gray-100 text-gray-500' }

  return (
    <tr
      onClick={() => router.push(`/funcionarios/${f.id}`)}
      className={cn('cursor-pointer hover:bg-gray-50 transition-colors', !f.ativo && 'opacity-50')}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
            {f.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.fotoUrl} alt={f.nome} className="w-full h-full object-cover" />
            ) : <HardHat className="w-4 h-4 text-gray-300" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{f.nome}{!f.ativo && <span className="text-xs text-gray-400 font-normal"> · inativo</span>}</p>
            <p className="text-xs text-gray-500 truncate">{f.cargo || 'Sem cargo'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-gray-600">{f.empresa || '—'}</td>
      <td className="px-4 py-2.5">
        <Badge className={f.vinculo === 'terceirizado' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}>{VINCULO_LABEL[f.vinculo]}</Badge>
        {f.situacao === 'avulso' && <Badge className="bg-orange-50 text-orange-700 ml-1">Avulso</Badge>}
      </td>
      <td className="px-4 py-2.5"><Badge className="bg-gray-100 text-gray-600">{REGIME_LABEL[f.regime]}</Badge></td>
      <td className="px-4 py-2.5 text-gray-600">
        {f.contratoRef ? (
          <span title={f.contratoRef.name} className="text-xs">
            <span className="font-medium text-gray-800">{f.contratoRef.number}</span>
            <span className="text-gray-400"> · {f.contratoRef.name}</span>
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5">
        {f.alojado ? <Badge className="bg-emerald-50 text-emerald-700">Sim</Badge> : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5"><Badge className={treinoBadge.cls}>{treinoBadge.txt}</Badge></td>
    </tr>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium', className)}>{children}</span>
}

// ─── Modal de novo funcionário ───────────────────────────────────────────────

function NovoFuncionarioModal({ contratos, onClose, onCreated }: {
  contratos: Contrato[]; onClose: () => void; onCreated: (id: string) => void
}) {
  const [nome, setNome]         = useState('')
  const [cargo, setCargo]       = useState('')
  const [empresa, setEmpresa]   = useState('')
  const [cpf, setCpf]           = useState('')
  const [vinculo, setVinculo]   = useState('proprio')
  const [situacao, setSituacao] = useState('contratado')
  const [regime, setRegime]     = useState('clt')
  const [alojado, setAlojado]   = useState(false)
  const [contratoId, setContratoId] = useState('')
  const [fotoUrl, setFotoUrl]   = useState<string | null>(null)

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), cargo: cargo.trim() || null, empresa: empresa.trim() || null, cpf: cpf.trim() || null, vinculo, situacao, regime, alojado, contratoId: contratoId || null, fotoUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao cadastrar')
      return json.data
    },
    onSuccess: (d) => onCreated(d.id),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Novo funcionário</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <FotoCapture value={fotoUrl} onChange={setFotoUrl} />

        <div className="space-y-3">
          <Field label="Nome *">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="modal-input" placeholder="Nome completo" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cargo / função">
              <FuncaoSelect value={cargo} onChange={setCargo} className="modal-input" />
            </Field>
            <Field label="CPF">
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="modal-input" placeholder="000.000.000-00" />
            </Field>
          </div>
          <Field label="Empresa">
            <EmpresaSelect value={empresa} onChange={setEmpresa} className="modal-input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vínculo">
              <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className="modal-input">
                <option value="proprio">Próprio</option>
                <option value="terceirizado">Terceirizado</option>
              </select>
            </Field>
            <Field label="Situação">
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className="modal-input">
                <option value="contratado">Contratado</option>
                <option value="avulso">Avulso</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Regime">
              <select value={regime} onChange={(e) => setRegime(e.target.value)} className="modal-input">
                <option value="diaria">Diária</option>
                <option value="clt">CLT</option>
                <option value="pj">PJ</option>
              </select>
            </Field>
            <Field label="Alojado?">
              <select value={alojado ? 'true' : 'false'} onChange={(e) => setAlojado(e.target.value === 'true')} className="modal-input">
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </Field>
          </div>
          <Field label="Alocação (contrato)">
            <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className="modal-input">
              <option value="">Sem alocação</option>
              {contratos.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.name}</option>)}
            </select>
          </Field>
        </div>

        {createM.isError && <p className="text-xs text-red-600">{(createM.error as Error).message}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button
            onClick={() => createM.mutate()}
            disabled={createM.isPending || !nome.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cadastrar
          </button>
        </div>
      </div>
      <style jsx global>{`
        .modal-input {
          width: 100%;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: white;
        }
        .modal-input:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-600 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  )
}
