import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canViewRental } from '@/lib/permissions'
import Link from 'next/link'
import { Truck, ArrowLeft, Wrench, ExternalLink } from 'lucide-react'

export default async function FrotaPorContratoPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!canViewRental(session)) redirect('/dashboard')

  const alocacoes = await prisma.alocacaoAtivo.findMany({
    where: {
      dataFim: null,
      ativo: { tipo: 'veiculo' },
    },
    include: {
      ativo: {
        select: {
          id: true, tag: true, descricao: true, categoria: true,
          placa: true, marca: true, modelo: true,
          valorLocacaoMensal: true,
          _count: { select: { ordensServico: { where: { status: { in: ['aberta', 'em_execucao'] } } } } },
        },
      },
      contrato: { select: { id: true, number: true, name: true } },
      projeto:  { select: { id: true, name: true } },
    },
    orderBy: [{ contrato: { number: 'asc' } }, { ativo: { tag: 'asc' } }],
  })

  // Agrupa por contrato
  const porContrato = new Map<string, {
    contrato: { id: string; number: string; name: string }
    itens: typeof alocacoes
  }>()
  for (const a of alocacoes) {
    const key = a.contrato.id
    if (!porContrato.has(key)) porContrato.set(key, { contrato: a.contrato, itens: [] })
    porContrato.get(key)!.itens.push(a)
  }
  const grupos = Array.from(porContrato.values())

  const totalMes = alocacoes.reduce((s, a) => s + a.ativo.valorLocacaoMensal, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/frota/ativos" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Todos os veículos
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Veículos por contrato
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {alocacoes.length} veículo{alocacoes.length !== 1 ? 's' : ''} alocado{alocacoes.length !== 1 ? 's' : ''} em {grupos.length} contrato{grupos.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-semibold text-gray-700">
              {totalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
            </span>
          </p>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum veículo alocado no momento</p>
          <Link href="/frota/ativos" className="mt-3 inline-block text-xs text-blue-600 hover:underline">Ver todos os veículos</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(({ contrato, itens }) => {
            const totalContrato = itens.reduce((s, a) => s + a.ativo.valorLocacaoMensal, 0)
            const porFrente = new Map<string, typeof itens>()
            for (const item of itens) {
              const k = item.projeto?.name ?? '—'
              if (!porFrente.has(k)) porFrente.set(k, [])
              porFrente.get(k)!.push(item)
            }

            return (
              <div key={contrato.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header do contrato */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{contrato.number}</p>
                    <p className="text-xs text-gray-500">{contrato.name}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span><span className="font-semibold text-blue-700">{itens.length}</span> veículo{itens.length !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-gray-800">
                      {totalContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
                    </span>
                  </div>
                </div>

                {/* Tabela de itens */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">TAG</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Descrição</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Categoria</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Placa</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Frente</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Desde</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">R$/mês</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">OS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {itens.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <Link
                              href={`/frota/ativos/${item.ativo.id}`}
                              className="font-mono text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
                            >
                              {item.ativo.tag}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <p className="text-xs text-gray-800 truncate">{item.ativo.descricao}</p>
                            {(item.ativo.marca || item.ativo.modelo) && (
                              <p className="text-xs text-gray-400">{[item.ativo.marca, item.ativo.modelo].filter(Boolean).join(' · ')}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{item.ativo.categoria}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs text-gray-400">{item.ativo.placa ?? '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{item.projeto?.name ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">
                            {new Date(item.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm font-semibold text-gray-800">
                            {item.ativo.valorLocacaoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            {item.ativo._count.ordensServico > 0
                              ? <span className="inline-flex items-center gap-0.5 text-xs text-orange-600"><Wrench className="w-3 h-3" />{item.ativo._count.ordensServico}</span>
                              : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={6} className="px-4 py-2 text-xs text-gray-500">Subtotal do contrato</td>
                        <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">
                          {totalContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
