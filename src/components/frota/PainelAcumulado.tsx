'use client'

import { useState } from 'react'
import { X, TrendingUp, CalendarDays, DollarSign } from 'lucide-react'
import Link from 'next/link'

type ItemAcumulado = {
  id: string
  tag: string
  descricao: string
  categoria: string
  contratoNumber: string
  contratoName: string
  dataInicio: Date | string
  diasAcumulados: number
  valorDia: number
  estimado: number
}

interface Props {
  itens: ItemAcumulado[]
  tipo: 'veiculo' | 'equipamento'
}

export function PainelAcumulado({ itens, tipo }: Props) {
  const [open, setOpen] = useState(false)

  if (itens.length === 0) return null

  const totalEstimado = itens.reduce((s, i) => s + i.estimado, 0)
  const diasMedio     = itens.length > 0 ? Math.round(itens.reduce((s, i) => s + i.diasAcumulados, 0) / itens.length) : 0
  const href          = tipo === 'veiculo' ? '/frota/medicoes/nova' : '/equipamentos/medicoes/nova'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
      >
        <TrendingUp className="w-4 h-4" />
        Acumulado
        <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-1.5 py-0.5 rounded-full">
          {itens.length}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  Acumulado no período atual
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {itens.length} ativo{itens.length !== 1 ? 's' : ''} alocado{itens.length !== 1 ? 's' : ''} · média de {diasMedio} dias acumulados
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo */}
            <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between flex-shrink-0">
              <span className="text-sm text-purple-700 font-medium flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Estimativa de faturamento acumulado
              </span>
              <span className="text-xl font-bold text-purple-900">
                {totalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Ativo</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contrato</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Dias</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...itens].sort((a, b) => b.diasAcumulados - a.diasAcumulados).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono font-bold text-blue-700">{item.tag}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{item.descricao}</p>
                        <p className="text-xs text-gray-400">{item.categoria}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs font-semibold text-gray-700 truncate">{item.contratoNumber}</p>
                        <p className="text-xs text-gray-400 truncate" title={item.contratoName}>{item.contratoName}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                          <CalendarDays className="w-3 h-3" />
                          desde {new Date(item.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DiaBadge dias={item.diasAcumulados} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {item.estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.valorDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/dia
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-400">Estimativa baseada em dias corridos × valor mensal ÷ 30</p>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-colors"
              >
                Criar medição
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DiaBadge({ dias }: { dias: number }) {
  const cls =
    dias === 0  ? 'bg-gray-100 text-gray-400' :
    dias <= 10  ? 'bg-green-100 text-green-700' :
    dias <= 20  ? 'bg-yellow-100 text-yellow-700' :
    dias <= 30  ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      <CalendarDays className="w-3 h-3" />
      {dias}d
    </span>
  )
}
