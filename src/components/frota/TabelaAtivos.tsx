'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wrench, Link2, Unlink, ExternalLink,
  ChevronUp, ChevronDown, X, CalendarDays,
} from 'lucide-react'
import { AlocarAtivoModal } from '@/components/frota/AlocarAtivoModal'
import { NovaOSModal } from '@/components/frota/NovaOSModal'
import { AlocarLoteModal } from '@/components/frota/AlocarLoteModal'

type Alocacao = {
  dataInicio: Date | string
  contrato: { id: string; number: string; name: string }
  projeto?: { name: string } | null
}

type Ativo = {
  id: string
  tag: string
  descricao: string
  tipo: string
  categoria: string
  placa?: string | null
  numeroserie?: string | null
  marca?: string | null
  modelo?: string | null
  anoFabricacao?: number | null
  valorLocacaoMensal: number
  status: string
  observacoes?: string | null
  alocacoes: Alocacao[]
  medicaoItens: Array<{ medicao: { competenciaAno: number; competenciaMes: number } }>
  _count: { ordensServico: number }
}

function calcDias(ativo: Ativo, aloc: Alocacao | undefined): number {
  if (!aloc) return 0
  const ultima = ativo.medicaoItens[0]?.medicao
  let desde: Date
  if (ultima) {
    // primeiro dia do mês seguinte ao último período faturado
    desde = new Date(ultima.competenciaAno, ultima.competenciaMes, 1)
    const inicioAloc = new Date(aloc.dataInicio)
    if (inicioAloc > desde) desde = inicioAloc
  } else {
    desde = new Date(aloc.dataInicio)
  }
  return Math.max(0, Math.floor((Date.now() - desde.getTime()) / 86400000))
}

function DiaBadge({ dias }: { dias: number }) {
  const cls =
    dias === 0  ? 'bg-gray-100 text-gray-400' :
    dias <= 10  ? 'bg-green-100 text-green-700' :
    dias <= 20  ? 'bg-yellow-100 text-yellow-700' :
    dias <= 30  ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`} title="Dias acumulados no período atual (desde última medição)">
      <CalendarDays className="w-3 h-3" />
      {dias}d
    </span>
  )
}

type SortKey = 'tag' | 'descricao' | 'status' | 'contrato' | 'desde' | 'valor'

const STATUS_META: Record<string, { label: string; dot: string; row: string; badge: string }> = {
  disponivel: { label: 'Disponível',  dot: 'bg-green-400',  row: '',                badge: 'bg-green-50 text-green-700 border-green-200' },
  alocado:    { label: 'Alocado',     dot: 'bg-blue-400',   row: 'bg-blue-50/30',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  manutencao: { label: 'Manutenção',  dot: 'bg-orange-400', row: 'bg-orange-50/40', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  inativo:    { label: 'Inativo',     dot: 'bg-gray-300',   row: 'opacity-60',      badge: 'bg-gray-100 text-gray-500 border-gray-200' },
}

interface Props {
  ativos: Ativo[]
  canEdit: boolean
  tipo: 'veiculo' | 'equipamento'
  baseHref: string
}

export function TabelaAtivos({ ativos, canEdit, tipo, baseHref }: Props) {
  const router = useRouter()
  const [confirmDesalocar, setConfirmDesalocar] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showLote, setShowLote] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  function sorted(list: Ativo[]) {
    return [...list].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'tag')       { va = a.tag;       vb = b.tag }
      if (sortKey === 'descricao') { va = a.descricao; vb = b.descricao }
      if (sortKey === 'status')    { va = a.status;    vb = b.status }
      if (sortKey === 'contrato')  { va = a.alocacoes[0]?.contrato.number ?? ''; vb = b.alocacoes[0]?.contrato.number ?? '' }
      if (sortKey === 'desde')     { va = a.alocacoes[0]?.dataInicio ? new Date(a.alocacoes[0].dataInicio).getTime() : 0; vb = b.alocacoes[0]?.dataInicio ? new Date(b.alocacoes[0].dataInicio).getTime() : 0 }
      if (sortKey === 'valor')     { va = a.valorLocacaoMensal; vb = b.valorLocacaoMensal }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
  }

  const disponiveisIds = ativos.filter((a) => a.status === 'disponivel').map((a) => a.id)
  const allDisponiveisSelected = disponiveisIds.length > 0 && disponiveisIds.every((id) => selectedIds.has(id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allDisponiveisSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(disponiveisIds))
  }

  async function desalocar(ativoId: string) {
    setLoadingId(ativoId)
    try {
      const res = await fetch(`/api/frota/ativos/${ativoId}/alocacao`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Erro ao desalocar'); return }
      setConfirmDesalocar(null)
      router.refresh()
    } finally { setLoadingId(null) }
  }

  function Th({ label, sortable, k }: { label: string; sortable?: SortKey; k?: string }) {
    if (!sortable) return (
      <th key={k} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
        {label}
      </th>
    )
    const active = sortKey === sortable
    return (
      <th
        key={k}
        onClick={() => toggleSort(sortable)}
        className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-800 transition-colors"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active
            ? (sortAsc ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />)
            : <ChevronUp className="w-3 h-3 text-gray-300" />}
        </span>
      </th>
    )
  }

  if (ativos.length === 0) return null

  const lista = sorted(ativos)
  const showPlaca = tipo === 'veiculo'
  const selectedAtivos = ativos.filter((a) => selectedIds.has(a.id))

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Checkbox col — só quando canEdit e há disponíveis */}
                {canEdit && disponiveisIds.length > 0 && (
                  <th className="pl-3 pr-1 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allDisponiveisSelected}
                      onChange={toggleSelectAll}
                      title="Selecionar todos disponíveis"
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                )}
                <Th label="TAG"        sortable="tag"      k="tag" />
                <Th label="Descrição"  sortable="descricao" k="desc" />
                <Th label="Categoria"  k="cat" />
                {showPlaca
                  ? <Th label="Placa"    k="placa" />
                  : <Th label="Nº Série" k="serie" />}
                <Th label="Status"     sortable="status"   k="status" />
                <Th label="Contrato"   sortable="contrato" k="cont" />
                <Th label="Frente"     k="frente" />
                <Th label="Desde"      sortable="desde"    k="desde" />
                <Th label="R$/mês"     sortable="valor"    k="valor" />
                <Th label="Dias"       k="dias" />
                <Th label="OS"         k="os" />
                {canEdit && <Th label="Ações" k="acoes" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((ativo) => {
                const meta   = STATUS_META[ativo.status] ?? STATUS_META.disponivel
                const aloc   = ativo.alocacoes[0]
                const osQtd  = ativo._count.ordensServico
                const isConf = confirmDesalocar === ativo.id
                const isLoad = loadingId === ativo.id
                const isSelected = selectedIds.has(ativo.id)
                const isDisponivel = ativo.status === 'disponivel'

                return (
                  <tr
                    key={ativo.id}
                    className={`group transition-colors hover:bg-gray-50 ${meta.row} ${isSelected ? 'ring-1 ring-inset ring-blue-400' : ''}`}
                  >
                    {/* Checkbox */}
                    {canEdit && disponiveisIds.length > 0 && (
                      <td className="pl-3 pr-1 py-2.5 w-8">
                        {isDisponivel ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(ativo.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer"
                          />
                        ) : (
                          <span className="block w-3.5 h-3.5" />
                        )}
                      </td>
                    )}

                    {/* TAG */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link
                        href={`${baseHref}/${ativo.id}`}
                        className="font-mono text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                      >
                        {ativo.tag}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </Link>
                    </td>

                    {/* Descrição */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <p className="text-sm text-gray-900 truncate" title={ativo.descricao}>{ativo.descricao}</p>
                      {(ativo.marca || ativo.modelo) && (
                        <p className="text-xs text-gray-400 truncate">{[ativo.marca, ativo.modelo, ativo.anoFabricacao].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>

                    {/* Categoria */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs text-gray-600">{ativo.categoria}</span>
                    </td>

                    {/* Placa ou Nº Série */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-500">
                        {showPlaca ? (ativo.placa ?? '—') : (ativo.numeroserie ?? '—')}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>

                    {/* Contrato */}
                    <td className="px-3 py-2.5 max-w-[180px]">
                      {aloc ? (
                        <div>
                          <p className="text-xs font-semibold text-gray-800 truncate">{aloc.contrato.number}</p>
                          <p className="text-xs text-gray-400 truncate" title={aloc.contrato.name}>{aloc.contrato.name}</p>
                        </div>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>

                    {/* Frente */}
                    <td className="px-3 py-2.5 max-w-[120px]">
                      {aloc?.projeto
                        ? <span className="text-xs text-gray-500 truncate block" title={aloc.projeto.name}>{aloc.projeto.name}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>

                    {/* Desde */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {aloc
                        ? <span className="text-xs text-gray-500">{new Date(aloc.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>

                    {/* Valor/mês */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-800">
                        {ativo.valorLocacaoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </span>
                    </td>

                    {/* Dias acumulados */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      {aloc ? <DiaBadge dias={calcDias(ativo, aloc)} /> : <span className="text-xs text-gray-300">—</span>}
                    </td>

                    {/* OS */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      {osQtd > 0
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600"><Wrench className="w-3 h-3" />{osQtd}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>

                    {/* Ações */}
                    {canEdit && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isConf ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-amber-700 font-medium">Desalocar?</span>
                            <button onClick={() => desalocar(ativo.id)} disabled={isLoad}
                              className="px-2 py-1 text-xs text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50">
                              {isLoad ? '…' : 'Sim'}
                            </button>
                            <button onClick={() => setConfirmDesalocar(null)}
                              className="px-2 py-1 text-xs text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50">
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {ativo.status === 'disponivel' && !isSelected && (
                              <AlocarAtivoModal
                                ativoId={ativo.id}
                                ativoTag={ativo.tag}
                                ativoDescricao={ativo.descricao}
                                compact
                              />
                            )}
                            {ativo.status === 'alocado' && (
                              <button
                                onClick={() => setConfirmDesalocar(ativo.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-700 border border-amber-300 rounded hover:bg-amber-50 transition-colors"
                                title="Desalocar"
                              >
                                <Unlink className="w-3 h-3" />
                                Desalocar
                              </button>
                            )}
                            {ativo.status !== 'inativo' && (
                              <NovaOSModal ativoId={ativo.id} ativoTag={ativo.tag} compact />
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totalizador */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span><span className="font-semibold text-blue-700">{ativos.filter((a) => a.status === 'alocado').length}</span> alocados</span>
            <span><span className="font-semibold text-green-700">{ativos.filter((a) => a.status === 'disponivel').length}</span> disponíveis</span>
            {ativos.some((a) => a.status === 'manutencao') && (
              <span><span className="font-semibold text-orange-600">{ativos.filter((a) => a.status === 'manutencao').length}</span> em manutenção</span>
            )}
            <span className="font-semibold text-gray-700">
              Total: {ativos.reduce((s, a) => s + a.valorLocacaoMensal, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
            </span>
          </div>
        </div>
      </div>

      {/* Barra flutuante de seleção */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 border border-gray-700">
          <span className="text-sm font-medium text-gray-300">
            <span className="text-white font-bold">{selectedIds.size}</span> ativo{selectedIds.size !== 1 ? 's' : ''} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={() => setShowLote(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Alocar para contrato
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white transition-colors" title="Limpar seleção">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal de alocação em lote */}
      {showLote && (
        <AlocarLoteModal
          count={selectedIds.size}
          tags={selectedAtivos.map((a) => a.tag)}
          ativoIds={Array.from(selectedIds)}
          onSuccess={() => {
            setShowLote(false)
            setSelectedIds(new Set())
            router.refresh()
          }}
          onClose={() => setShowLote(false)}
        />
      )}
    </>
  )
}
