'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Save, Trash2, Loader2, Plus, X, Users, Wrench, AlertTriangle, Camera } from 'lucide-react'
import { FuncaoSelect } from '@/components/funcionarios/FuncaoSelect'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'

interface Func { funcao: string; quantidade: number }
interface AtivoRow { ativoId: string | null; tipo: string; descricao: string; quantidade: number; origem: string }
interface AtivoRental { id: string; tag: string; descricao: string; tipo: string }

const TIPO_LABEL: Record<string, string> = { maquina: 'Máquina', equipamento: 'Equipamento', veiculo: 'Veículo' }

export default function AcompanhamentoDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: session } = useSession()

  const { data, isLoading } = useQuery({ queryKey: ['acomp', params.id], queryFn: () => fetch(`/api/acompanhamento/${params.id}`).then((r) => r.json()) })
  const r = data?.data

  const [dataVisita, setDataVisita] = useState('')
  const [producao, setProducao] = useState('')
  const [teveOcorrencia, setTeveOcorrencia] = useState(false)
  const [ocorrencias, setOcorrencias] = useState('')
  const [opiniao, setOpiniao] = useState('')
  const [funcoes, setFuncoes] = useState<Func[]>([])
  const [ativos, setAtivos] = useState<AtivoRow[]>([])
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!r) return
    setDataVisita(r.dataVisita ? new Date(r.dataVisita).toISOString().slice(0, 10) : '')
    setProducao(r.producaoDia ?? '')
    setTeveOcorrencia(!!r.teveOcorrencia)
    setOcorrencias(r.ocorrencias ?? '')
    setOpiniao(r.opiniao ?? '')
    setFuncoes((r.funcoes ?? []).map((f: any) => ({ funcao: f.funcao, quantidade: f.quantidade })))
    setAtivos((r.ativos ?? []).map((a: any) => ({ ativoId: a.ativoId, tipo: a.tipo, descricao: a.descricao, quantidade: a.quantidade, origem: a.origem })))
  }, [r?.id])

  const saveM = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/acompanhamento/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataVisita: dataVisita ? new Date(dataVisita + 'T12:00:00').toISOString() : undefined,
          producaoDia: producao || null,
          teveOcorrencia,
          ocorrencias: teveOcorrencia ? (ocorrencias || null) : null,
          opiniao: opiniao || null,
          funcoes: funcoes.filter((f) => f.funcao.trim()),
          ativos: ativos.filter((a) => a.descricao.trim()).map((a) => ({ ...a, tipo: a.tipo as any })),
        }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acomp', params.id] }); qc.invalidateQueries({ queryKey: ['acompanhamento'] }) },
  })

  const delM = useMutation({
    mutationFn: async () => { const res = await fetch(`/api/acompanhamento/${params.id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Erro') },
    onSuccess: () => router.push('/areas/planejamento?tab=acompanhamento'),
  })

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
  if (!r) return <p className="text-sm text-gray-400 py-12 text-center">Relatório não encontrado.</p>

  const efetivoTotal = funcoes.reduce((s, f) => s + (Number(f.quantidade) || 0), 0)
  const porTipo = (t: string) => ativos.filter((a) => a.tipo === t).reduce((s, a) => s + (Number(a.quantidade) || 0), 0)

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/areas/planejamento?tab=acompanhamento" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" /> Acompanhamento de Obras
      </Link>

      {/* Cabeçalho */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-mono text-gray-400">{r.contrato.number}</p>
        <h1 className="text-xl font-bold text-gray-900">{r.contrato.name}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <label className="block text-xs font-medium text-gray-600 space-y-1">
            <span>Data da visita</span>
            <input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} className="finput" />
          </label>
          <div className="text-xs text-gray-500">
            <span className="block font-medium text-gray-600 mb-1">Analista</span>
            <span className="inline-block py-2">{r.analista?.name}</span>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ResumoCard icon={<Users className="w-4 h-4" />} label="Efetivo total" value={efetivoTotal} />
        <ResumoCard icon={<Wrench className="w-4 h-4" />} label="Máquinas" value={porTipo('maquina')} />
        <ResumoCard icon={<Wrench className="w-4 h-4" />} label="Equipamentos" value={porTipo('equipamento')} />
        <ResumoCard icon={<Wrench className="w-4 h-4" />} label="Veículos" value={porTipo('veiculo')} />
      </div>

      {/* Efetivo por função */}
      <Secao titulo="Efetivo por função" icon={<Users className="w-4 h-4" />}>
        <FuncoesEditor funcoes={funcoes} setFuncoes={setFuncoes} />
      </Secao>

      {/* Máquinas / Equipamentos / Veículos */}
      <Secao titulo="Máquinas, equipamentos e veículos" icon={<Wrench className="w-4 h-4" />}>
        <AtivosEditor ativos={ativos} setAtivos={setAtivos} />
      </Secao>

      {/* Produção do dia */}
      <Secao titulo="Produção do dia">
        <textarea value={producao} onChange={(e) => setProducao(e.target.value)} rows={2} className="finput resize-none" placeholder="O que foi produzido/executado no dia do acompanhamento…" />
      </Secao>

      {/* Ocorrências */}
      <Secao titulo="Ocorrências" icon={<AlertTriangle className="w-4 h-4" />}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-600">Houve ocorrência?</span>
          <button onClick={() => setTeveOcorrencia(false)} className={`px-3 py-1 text-xs rounded-lg font-medium ${!teveOcorrencia ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Não</button>
          <button onClick={() => setTeveOcorrencia(true)} className={`px-3 py-1 text-xs rounded-lg font-medium ${teveOcorrencia ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Sim</button>
        </div>
        {teveOcorrencia && (
          <textarea value={ocorrencias} onChange={(e) => setOcorrencias(e.target.value)} rows={3} className="finput resize-none" placeholder="Descreva a(s) ocorrência(s)…" />
        )}
      </Secao>

      {/* Opinião do analista */}
      <Secao titulo="Análise do analista (vs. planejado)">
        <textarea value={opiniao} onChange={(e) => setOpiniao(e.target.value)} rows={5} className="finput resize-none" placeholder="Sua opinião sobre o que viu, comparando a execução com o planejamento aprovado…" />
      </Secao>

      {/* Salvar */}
      <div className="flex items-center justify-between gap-2">
        {confirmDel ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="text-gray-600">Excluir relatório?</span>
            <button onClick={() => delM.mutate()} disabled={delM.isPending} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">Sim</button>
            <button onClick={() => setConfirmDel(false)} className="px-2 py-1.5 text-gray-500 text-xs">Cancelar</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
        )}
        <button onClick={() => saveM.mutate()} disabled={saveM.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
          {saveM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar relatório
        </button>
      </div>
      {saveM.isSuccess && <p className="text-xs text-green-600 text-right">Salvo!</p>}

      {/* Fotos */}
      <Secao titulo="Fotos do acompanhamento" icon={<Camera className="w-4 h-4" />}>
        {session?.user && (
          <AttachmentsPanel
            initialAttachments={r.attachments ?? []}
            objectType="relatorio_acomp"
            objectId={params.id}
            canUpload
            currentUserId={session.user.id}
            canDeleteAll
          />
        )}
      </Secao>

      <style jsx global>{`
        .finput { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
        .finput:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
      `}</style>
    </div>
  )
}

function Secao({ titulo, icon, children }: { titulo: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">{icon}{titulo}</h2>
      {children}
    </div>
  )
}

function ResumoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-1">{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function FuncoesEditor({ funcoes, setFuncoes }: { funcoes: Func[]; setFuncoes: (f: Func[]) => void }) {
  const upd = (i: number, patch: Partial<Func>) => setFuncoes(funcoes.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  return (
    <div className="space-y-2">
      {funcoes.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <FuncaoSelect value={f.funcao} onChange={(v) => upd(i, { funcao: v })} className="finput flex-1" />
          <input type="number" min={0} value={f.quantidade} onChange={(e) => upd(i, { quantidade: Number(e.target.value) || 0 })} className="finput !w-20 text-right" />
          <button onClick={() => setFuncoes(funcoes.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={() => setFuncoes([...funcoes, { funcao: '', quantidade: 1 }])} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
        <Plus className="w-4 h-4" /> Adicionar função
      </button>
    </div>
  )
}

function AtivosEditor({ ativos, setAtivos }: { ativos: AtivoRow[]; setAtivos: (a: AtivoRow[]) => void }) {
  const { data } = useQuery({ queryKey: ['ativos-rental'], queryFn: () => fetch('/api/frota/ativos').then((r) => r.json()) })
  const rentalAtivos: AtivoRental[] = (data?.data ?? []).map((a: any) => ({ id: a.id, tag: a.tag, descricao: a.descricao, tipo: a.tipo }))
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const upd = (i: number, patch: Partial<AtivoRow>) => setAtivos(ativos.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  const filtered = search.trim()
    ? rentalAtivos.filter((a) => `${a.tag} ${a.descricao}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : rentalAtivos.slice(0, 30)

  function addRental(a: AtivoRental) {
    setAtivos([...ativos, { ativoId: a.id, tipo: a.tipo === 'veiculo' ? 'veiculo' : 'equipamento', descricao: `${a.tag} — ${a.descricao}`, quantidade: 1, origem: 'rental' }])
    setPickerOpen(false); setSearch('')
  }

  return (
    <div className="space-y-2">
      {ativos.map((a, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <select value={a.tipo} onChange={(e) => upd(i, { tipo: e.target.value })} className="finput !w-32">
            <option value="maquina">Máquina</option>
            <option value="equipamento">Equipamento</option>
            <option value="veiculo">Veículo</option>
          </select>
          <input value={a.descricao} onChange={(e) => upd(i, { descricao: e.target.value })} readOnly={a.origem === 'rental'} className={`finput flex-1 min-w-[160px] ${a.origem === 'rental' ? 'bg-gray-50' : ''}`} placeholder="Descrição do item" />
          <input type="number" min={1} value={a.quantidade} onChange={(e) => upd(i, { quantidade: Number(e.target.value) || 1 })} className="finput !w-16 text-right" />
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.origem === 'rental' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{a.origem === 'rental' ? 'Rental' : 'Externo'}</span>
          <button onClick={() => setAtivos(ativos.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => setPickerOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
          <Plus className="w-4 h-4" /> Da Rental
        </button>
        <button onClick={() => setAtivos([...ativos, { ativoId: null, tipo: 'equipamento', descricao: '', quantidade: 1, origem: 'externo' }])} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
          <Plus className="w-4 h-4" /> Manual (locação externa)
        </button>
      </div>

      {pickerOpen && (
        <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-2">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ativo da Rental (TAG, descrição)…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 bg-white rounded-lg border border-gray-100">
            {filtered.length === 0 ? <p className="text-xs text-gray-400 p-3 text-center">Nenhum ativo.</p> : filtered.map((a) => (
              <button key={a.id} onClick={() => addRental(a)} className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2">
                <span className="text-sm text-gray-800 truncate"><span className="font-mono text-xs text-gray-400">{a.tag}</span> {a.descricao}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{a.tipo === 'veiculo' ? 'Veículo' : 'Equip.'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
