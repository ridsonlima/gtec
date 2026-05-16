import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { Handshake, TrendingUp, AlertTriangle, Clock, DollarSign, ChevronRight } from 'lucide-react'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtComp = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', at_risk: 'Em risco', delayed: 'Atrasado',
  suspended: 'Suspenso', completed: 'Concluído',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50 border-green-200',
  at_risk: 'text-red-700 bg-red-50 border-red-200',
  delayed: 'text-amber-700 bg-amber-50 border-amber-200',
  suspended: 'text-gray-600 bg-gray-100 border-gray-200',
  completed: 'text-blue-700 bg-blue-50 border-blue-200',
}

export default async function GestaoParceirosPage() {
  const session = await auth()
  if (!session) return null

  const allowedAreaIds = getUserAreaIds(session)

  const contracts = await prisma.contract.findMany({
    where: {
      executionModality: 'partner',
      ...(allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}),
    },
    include: {
      area: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      partner: true,
      medicoes: {
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        include: { adiantamentos: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const contratos = contracts.map((c) => {
    const pct = c.partner?.percentageGlobal ?? 0
    const totais = c.medicoes.reduce(
      (acc, m) => {
        const somaAdiant = m.adiantamentos.reduce((s, a) => s + a.valor, 0)
        const repasse = (m.valorFaturado * pct) / 100
        return {
          produzido: acc.produzido + m.valorProduzido,
          aprovado: acc.aprovado + m.valorAprovado,
          faturado: acc.faturado + m.valorFaturado,
          contestacao: acc.contestacao + (m.valorProduzido - m.valorAprovado),
          prateleira: acc.prateleira + (m.valorAprovado - m.valorFaturado),
          repasse: acc.repasse + repasse,
          adiantamentos: acc.adiantamentos + somaAdiant,
          repasse_liq: acc.repasse_liq + (repasse - somaAdiant),
        }
      },
      { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, adiantamentos: 0, repasse_liq: 0 }
    )
    return { ...c, totais, ultimaMedicao: c.medicoes[0] ?? null }
  })

  const grand = contratos.reduce(
    (acc, c) => ({
      produzido: acc.produzido + c.totais.produzido,
      aprovado: acc.aprovado + c.totais.aprovado,
      faturado: acc.faturado + c.totais.faturado,
      contestacao: acc.contestacao + c.totais.contestacao,
      prateleira: acc.prateleira + c.totais.prateleira,
      repasse: acc.repasse + c.totais.repasse,
      repasse_liq: acc.repasse_liq + c.totais.repasse_liq,
    }),
    { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, repasse_liq: 0 }
  )

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Handshake className="w-6 h-6 text-blue-600" />
          Gestão de Parceiros
        </h1>
        <p className="text-sm text-gray-500 mt-1">{contratos.length} contrato{contratos.length !== 1 ? 's' : ''} com parceiro</p>
      </div>

      {/* Cards de totais consolidados */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card icon={<TrendingUp className="w-4 h-4 text-gray-500" />} label="Produzido" value={fmt(grand.produzido)} />
        <Card icon={<DollarSign className="w-4 h-4 text-blue-500" />} label="Faturado" value={fmt(grand.faturado)} color="text-blue-700" />
        <Card icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} label="Contestação" value={fmt(grand.contestacao)} color={grand.contestacao > 0 ? 'text-amber-700' : 'text-gray-400'} />
        <Card icon={<Clock className="w-4 h-4 text-yellow-500" />} label="Prateleira" value={fmt(grand.prateleira)} color={grand.prateleira > 0 ? 'text-yellow-700' : 'text-gray-400'} />
        <Card icon={<DollarSign className="w-4 h-4 text-blue-400" />} label="Repasse bruto" value={fmt(grand.repasse)} color="text-blue-600" />
        <Card icon={<DollarSign className="w-4 h-4 text-green-500" />} label="Repasse líquido" value={fmt(grand.repasse_liq)} color={grand.repasse_liq < 0 ? 'text-red-600' : 'text-green-700'} />
      </div>

      {/* Tabela de contratos */}
      {contratos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhum contrato com parceiro cadastrado
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Contrato</th>
                  <th className="text-left px-4 py-3">Parceiro</th>
                  <th className="text-center px-4 py-3">%</th>
                  <th className="text-center px-4 py-3">Última comp.</th>
                  <th className="text-right px-4 py-3">Produzido</th>
                  <th className="text-right px-4 py-3 text-amber-600">Contest.</th>
                  <th className="text-right px-4 py-3 text-yellow-600">Prateleira</th>
                  <th className="text-right px-4 py-3">Faturado</th>
                  <th className="text-right px-4 py-3 text-green-700">Rep. Líq.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.number} · {c.area.name}</p>
                        <span className={`inline-flex text-xs font-medium px-1.5 py-0.5 rounded-full border mt-0.5 ${STATUS_COLORS[c.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.partner ? (
                        <div>
                          <p className="text-gray-700">{c.partner.name}</p>
                          {c.partner.contactName && <p className="text-xs text-gray-400">{c.partner.contactName}</p>}
                        </div>
                      ) : (
                        <Link href={`/contratos/${c.id}`} className="text-xs text-blue-500 hover:underline">Cadastrar parceiro</Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">
                      {c.partner ? `${c.partner.percentageGlobal}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {c.ultimaMedicao ? fmtComp(c.ultimaMedicao.competenciaAno, c.ultimaMedicao.competenciaMes) : <span className="text-gray-300">Sem medições</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(c.totais.produzido)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${c.totais.contestacao > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                      {c.totais.contestacao > 0 ? fmt(c.totais.contestacao) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${c.totais.prateleira > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>
                      {c.totais.prateleira > 0 ? fmt(c.totais.prateleira) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(c.totais.faturado)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${c.totais.repasse_liq < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {fmt(c.totais.repasse_liq)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/contratos/${c.id}`} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100 inline-flex">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ icon, label, value, color = 'text-gray-800' }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 mb-1 text-gray-400 text-xs">{icon}{label}</div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
