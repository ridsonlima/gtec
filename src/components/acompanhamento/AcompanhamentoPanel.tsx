'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, X, Loader2, Users, Wrench, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react'

interface Contrato { id: string; number: string; name: string }
interface Relatorio {
  id: string; dataVisita: string; teveOcorrencia: boolean
  contrato: { id: string; number: string; name: string }
  analista: { name: string }
  funcoes: { quantidade: number }[]
  ativos: { tipo: string; quantidade: number }[]
}

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function AcompanhamentoPanel() {
  const router = useRouter()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [fObra, setFObra] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['acompanhamento'], queryFn: () => fetch('/api/acompanhamento').then((r) => r.json()) })
  const relatorios: Relatorio[] = data?.data?.relatorios ?? []
  const contratos: Contrato[] = data?.data?.contratos ?? []
  const filtrados = fObra ? relatorios.filter((r) => r.contrato.id === fObra) : relatorios

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" /> Acompanhamento de Obras
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Auditorias de campo comparando a execução com o planejado.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={fObra} onChange={(e) => setFObra(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white max-w-[220px]">
            <option value="">Todas as obras</option>
            {contratos.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.name}</option>)}
          </select>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Novo relatório
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">Nenhum relatório de acompanhamento</p>
          <p className="text-xs text-gray-400 mt-1">Crie o primeiro com o botão “Novo relatório”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtrados.map((r) => {
            const efetivo = r.funcoes.reduce((s, f) => s + f.quantidade, 0)
            const ativos = r.ativos.reduce((s, a) => s + a.quantidade, 0)
            return (
              <Link key={r.id} href={`/acompanhamento/${r.id}`} className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-400">{r.contrato.number}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.contrato.name}</p>
                  </div>
                  {r.teveOcorrencia ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex-shrink-0"><AlertTriangle className="w-3 h-3" /> Ocorrência</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0"><CheckCircle2 className="w-3 h-3" /> Sem ocorrência</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtData(r.dataVisita)}</span>
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {efetivo} efetivo</span>
                  <span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> {ativos} ativos</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Analista: {r.analista.name}</p>
              </Link>
            )
          })}
        </div>
      )}

      {showNew && (
        <NovoRelatorioModal
          contratos={contratos}
          onClose={() => setShowNew(false)}
          onCreated={(id) => { qc.invalidateQueries({ queryKey: ['acompanhamento'] }); router.push(`/acompanhamento/${id}`) }}
        />
      )}
    </div>
  )
}

function NovoRelatorioModal({ contratos, onClose, onCreated }: { contratos: Contrato[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [contratoId, setContratoId] = useState('')
  const [dataVisita, setDataVisita] = useState(new Date().toISOString().slice(0, 10))

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/acompanhamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId, dataVisita: new Date(dataVisita + 'T12:00:00').toISOString() }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
      return j.data
    },
    onSuccess: (d) => onCreated(d.id),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md my-8 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Novo relatório de acompanhamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Obra (contrato) *</span>
          <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
            <option value="">Selecione a obra</option>
            {contratos.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600 space-y-1">
          <span>Data da visita *</span>
          <input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
        </label>
        {createM.isError && <p className="text-xs text-red-600">{(createM.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button onClick={() => createM.mutate()} disabled={!contratoId || createM.isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar e preencher
          </button>
        </div>
      </div>
    </div>
  )
}
