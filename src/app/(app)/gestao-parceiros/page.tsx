import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { Handshake, TrendingUp, AlertTriangle, Clock, DollarSign, ChevronRight } from 'lucide-react'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtComp = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`

const TIPO_LABELS: Record<string, string> = {
  gestao_obra: 'Gestão de Obra',
  locacao_maquinas: 'Locação de Máq.',
  nota_debito: 'Nota de Débito',
  outro: 'Outro',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50 border-green-200',
  at_risk: 'text-red-700 bg-red-50 border-red-200',
  delayed: 'text-amber-700 bg-amber-50 border-amber-200',
  suspended: 'text-gray-600 bg-gray-100 border-gray-200',
  completed: 'text-blue-700 bg-blue-50 border-blue-200',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', at_risk: 'Em risco', delayed: 'Atrasado', suspended: 'Suspenso', completed: 'Concluído',
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
      contractPartners: {
        include: {
          empresaParceira: true,
          instrumentos: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      medicoes: {
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        include: { adiantamentos: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const contratos = contracts.map((c) => {
    const totaisMed = c.medicoes.reduce(
      (acc, m) => ({
        produzido: acc.produzido + m.valorProduzido,
        aprovado: acc.aprovado + m.valorAprovado,
        faturado: acc.faturado + m.valorFaturado,
        contestacao: acc.contestacao + (m.valorProduzido - m.valorAprovado),
        prateleira: acc.prateleira + (m.valorAprovado - m.valorFaturado),
      }),
      { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0 }
    )

    const totalAdiantamentos = c.medicoes.reduce(
      (s, m) => s + m.adiantamentos.reduce((a, ad) => a + ad.valor, 0), 0
    )

    const parceiros = c.contractPartners.map((cp) => {
      const pct = cp.percentageTotal
      const repasse_bruto = (totaisMed.faturado * pct) / 100
      const somaFixos = cp.instrumentos
        .filter((i) => i.tipo !== 'nota_debito' && i.percentage != null)
        .reduce((s, i) => s + (i.percentage ?? 0), 0)

      const instrumentos = cp.instrumentos.map((i) => {
        const pctEfetivo = i.tipo === 'nota_debito' ? (pct - somaFixos) : (i.percentage ?? 0)
        return { ...i, pctEfetivo, valorRepasse: (totaisMed.faturado * pctEfetivo) / 100 }
      })

      return { cp, pct, repasse_bruto, instrumentos }
    })

    const totalRepasse = parceiros.reduce((s, p) => s + p.repasse_bruto, 0)

    return { ...c, totaisMed, totalAdiantamentos, parceiros, totalRepasse, ultimaMedicao: c.medicoes[0] ?? null }
  })

  const grand = contratos.reduce(
    (acc, c) => ({
      produzido: acc.produzido + c.totaisMed.produzido,
      aprovado: acc.aprovado + c.totaisMed.aprovado,
      faturado: acc.faturado + c.totaisMed.faturado,
      contestacao: acc.contestacao + c.totaisMed.contestacao,
      prateleira: acc.prateleira + c.totaisMed.prateleira,
      repasse: acc.repasse + c.totalRepasse,
      adiantamentos: acc.adiantamentos + c.totalAdiantamentos,
    }),
    { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse: 0, adiantamentos: 0 }
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

      {/* Cards consolidados */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card icon={<TrendingUp className="w-4 h-4 text-gray-500" />} label="Produzido" value={fmt(grand.produzido)} />
        <Card icon={<DollarSign className="w-4 h-4 text-blue-500" />} label="Faturado" value={fmt(grand.faturado)} color="text-blue-700" />
        <Card icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} label="Contestação" value={fmt(grand.contestacao)} color={grand.contestacao > 0 ? 'text-amber-700' : 'text-gray-400'} />
        <Card icon={<Clock className="w-4 h-4 text-yellow-500" />} label="Prateleira" value={fmt(grand.prateleira)} color={grand.prateleira > 0 ? 'text-yellow-700' : 'text-gray-400'} />
        <Card icon={<DollarSign className="w-4 h-4 text-blue-400" />} label="Repasse total" value={fmt(grand.repasse)} color="text-blue-600" />
        <Card icon={<DollarSign className="w-4 h-4 text-orange-400" />} label="Adiantamentos" value={fmt(grand.adiantamentos)} color="text-orange-600" />
        <Card icon={<DollarSign className="w-4 h-4 text-green-500" />} label="Repasse líquido" value={fmt(grand.repasse - grand.adiantamentos)} color={(grand.repasse - grand.adiantamentos) < 0 ? 'text-red-600' : 'text-green-700'} />
      </div>

      {/* Tabela de contratos */}
      {contratos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhum contrato com parceiro cadastrado
        </div>
      ) : (
        <div className="space-y-4">
          {contratos.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header do contrato */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{c.number}</span>
                    <span className="text-xs text-gray-400">{c.area.name}</span>
                    {c.ultimaMedicao && (
                      <span className="text-xs text-gray-400">última comp: {fmtComp(c.ultimaMedicao.competenciaAno, c.ultimaMedicao.competenciaMes)}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.name}</p>
                </div>
                <Link href={`/contratos/${c.id}`} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Medições resumidas */}
              <div className="px-5 py-3 bg-gray-50/40 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <Stat label="Produzido" value={fmt(c.totaisMed.produzido)} />
                <Stat label="Contestação" value={c.totaisMed.contestacao > 0 ? fmt(c.totaisMed.contestacao) : '—'} color={c.totaisMed.contestacao > 0 ? 'text-amber-600 font-semibold' : 'text-gray-300'} />
                <Stat label="Prateleira" value={c.totaisMed.prateleira > 0 ? fmt(c.totaisMed.prateleira) : '—'} color={c.totaisMed.prateleira > 0 ? 'text-yellow-600 font-semibold' : 'text-gray-300'} />
                <Stat label="Faturado" value={fmt(c.totaisMed.faturado)} />
                <Stat label="Medições" value={`${c.medicoes.length} comp.`} />
              </div>

              {/* Parceiros e instrumentos */}
              <div className="divide-y divide-gray-50">
                {c.parceiros.length === 0 && (
                  <div className="px-5 py-3 text-xs text-gray-400 italic">Nenhum parceiro vinculado</div>
                )}
                {c.parceiros.map(({ cp, pct, repasse_bruto, instrumentos }) => {
                  const somaFixos = instrumentos
                    .filter((i) => i.tipo !== 'nota_debito')
                    .reduce((s, i) => s + i.pctEfetivo, 0)

                  return (
                    <div key={cp.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{cp.empresaParceira.name}</p>
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{pct}%</span>
                          </div>
                          {cp.empresaParceira.cnpj && <p className="text-xs text-gray-400 mt-0.5">CNPJ: {cp.empresaParceira.cnpj}</p>}

                          {/* Distribuição por instrumento */}
                          {instrumentos.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {instrumentos.map((i) => (
                                <div key={i.id} className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                                  <span className="text-gray-500">{TIPO_LABELS[i.tipo] ?? i.tipo}</span>
                                  <span className="font-semibold text-gray-700">{i.pctEfetivo.toFixed(2)}%</span>
                                  <span className="text-gray-400">→ {fmt(i.valorRepasse)}</span>
                                  {i.tipo === 'nota_debito' && <span className="text-amber-500 italic text-xs">residual</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">Repasse bruto</p>
                          <p className="text-sm font-bold text-blue-700">{fmt(repasse_bruto)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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

function Stat({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className={`font-medium ${color}`}>{value}</p>
    </div>
  )
}
