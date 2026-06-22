'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, UserCheck, ShoppingCart, CheckCircle2, Award } from 'lucide-react'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

interface Aprovador { nome: string; tipo: string; prioridade: number; nivel: number; substituto?: string }
interface CotItemForn { nome: string; quantidade: number; unidade: string; valor: number; selecionada: boolean }
interface CotItem { descricao: string; unidade: string; melhorOferta: number; ofertaSelecionada: number; fornecedores: CotItemForn[] }
interface FornResumo { nome: string; documento?: string; condicaoPagamento?: string; somaUnitarios: number; totalSelecionado: number; total: number; selecionados: number }
interface Detalhe { aprovadores: Aprovador[]; itens: CotItem[]; fornecedores: FornResumo[] }

export function ApprovoDetalhe({ chaveCompleta }: { chaveCompleta?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Detalhe | null>(null)
  const [error, setError] = useState('')

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (data || loading) return
    if (!chaveCompleta) { setError('Documento sem chave para detalhe.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/approvo/detalhe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaveCompleta }),
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? 'Erro ao carregar detalhe')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar detalhe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {open ? 'Ocultar detalhe' : 'Ver aprovadores e mapa de cotação'}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando do Approvo…
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}

          {data && (
            <>
              {/* Aprovadores */}
              {data.aprovadores.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> Próximos aprovadores
                  </p>
                  <div className="space-y-1.5">
                    {data.aprovadores.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {a.nome.charAt(0)}
                        </span>
                        <span className="font-medium text-gray-800">{a.nome}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${a.tipo === 'M' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {a.tipo === 'M' ? 'Obrigatório' : 'Por alçada'}
                        </span>
                        {a.substituto && <span className="text-xs text-gray-400">· substituto: {a.substituto}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapa de cotação */}
              {data.itens.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" /> Mapa de cotação
                  </p>
                  <div className="space-y-3">
                    {data.itens.map((it, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-800">{it.descricao} <span className="text-xs font-normal text-gray-400">({it.unidade})</span></span>
                          <span className="text-xs text-green-700 font-medium inline-flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" /> Melhor: {fmtBRL(it.melhorOferta)}
                          </span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {[...it.fornecedores].sort((a, b) => a.valor - b.valor).map((f, j) => {
                            const total = f.valor * f.quantidade
                            const melhor = f.valor === it.melhorOferta
                            return (
                              <div key={j} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${f.selecionada ? 'bg-green-50/60' : ''}`}>
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {f.selecionada && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                                  <span className="text-gray-700 truncate">{f.nome}</span>
                                  {melhor && !f.selecionada && <span className="text-[10px] px-1 py-0.5 rounded bg-green-50 text-green-700">menor preço</span>}
                                </span>
                                <span className="text-right flex-shrink-0">
                                  <span className="text-gray-500 text-xs">{f.quantidade.toLocaleString('pt-BR')} {f.unidade} × {fmtBRL(f.valor)}</span>
                                  <span className="ml-2 font-semibold text-gray-900">{fmtBRL(total)}</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumo por fornecedor */}
              {data.fornecedores.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fornecedores</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 text-gray-500">
                        <th className="text-left font-semibold px-3 py-1.5">Fornecedor</th>
                        <th className="text-left font-semibold px-3 py-1.5">CNPJ</th>
                        <th className="text-left font-semibold px-3 py-1.5">Pagamento</th>
                        <th className="text-right font-semibold px-3 py-1.5">Total cotado</th>
                        <th className="text-right font-semibold px-3 py-1.5">Selecionado</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.fornecedores.map((f, i) => (
                          <tr key={i} className={f.totalSelecionado > 0 ? 'bg-green-50/40' : ''}>
                            <td className="px-3 py-1.5 font-medium text-gray-800">{f.nome}</td>
                            <td className="px-3 py-1.5 text-gray-500">{f.documento ?? '—'}</td>
                            <td className="px-3 py-1.5 text-gray-500">{f.condicaoPagamento ?? '—'}</td>
                            <td className="px-3 py-1.5 text-right text-gray-700">{fmtBRL(f.total)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-green-700">{f.totalSelecionado > 0 ? fmtBRL(f.totalSelecionado) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.aprovadores.length === 0 && data.itens.length === 0 && (
                <p className="text-xs text-gray-400">Sem detalhe adicional disponível para este documento.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
