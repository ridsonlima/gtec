import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Radar, AlertTriangle, CalendarClock, Receipt, RefreshCw, ArrowRightLeft, ChevronRight } from 'lucide-react'

type Alerta = {
  severidade: 'alta' | 'media'
  icon: any
  titulo: string
  detalhe: string
  href: string
}

/**
 * Alertas Preditivos — antecipa problemas ANTES de estourarem, por regras.
 * Não usa IA: regras transparentes e explicáveis.
 */
export async function AlertasPreditivos() {
  const hoje = new Date()
  const em30 = new Date(hoje.getTime() + 30 * 86400000)
  const em48h = new Date(hoje.getTime() + 2 * 86400000)

  const [contratos, slaRisco, alocacoesAtivas] = await Promise.all([
    prisma.contract.findMany({
      where: { status: { in: ['active', 'at_risk'] } },
      select: {
        id: true, number: true, name: true, endDate: true, physicalProgress: true,
        proposalDate: true, readjustmentCount: true,
      },
    }),
    prisma.demand.findMany({
      where: {
        acceptanceStatus: 'pending_acceptance',
        slaDeadline: { gte: hoje, lte: em48h },
      },
      select: { id: true, title: true, slaDeadline: true, area: { select: { name: true } } },
      orderBy: { slaDeadline: 'asc' },
      take: 5,
    }),
    prisma.alocacaoAtivo.findMany({
      where: { dataFim: null },
      select: { contratoId: true, contrato: { select: { number: true, name: true } } },
    }),
  ])

  const alertas: Alerta[] = []

  // ── Regra 1: contrato vencendo em 30d com baixo avanço físico ──────────────
  for (const c of contratos) {
    if (!c.endDate) continue
    const dias = Math.ceil((new Date(c.endDate).getTime() - hoje.getTime()) / 86400000)
    if (dias >= 0 && dias <= 30 && (c.physicalProgress == null || c.physicalProgress < 80)) {
      alertas.push({
        severidade: dias <= 15 ? 'alta' : 'media',
        icon: CalendarClock,
        titulo: `Contrato ${c.number} vence em ${dias}d`,
        detalhe: `Avanço físico em ${c.physicalProgress ?? 0}% — risco de não concluir a tempo`,
        href: `/contratos/${c.id}`,
      })
    }
  }

  // ── Regra 2: reajuste vencendo em 30d ──────────────────────────────────────
  for (const c of contratos) {
    if (!c.proposalDate) continue
    const base = new Date(c.proposalDate)
    const prox = new Date(base)
    prox.setFullYear(base.getFullYear() + c.readjustmentCount + 1)
    const dias = Math.ceil((prox.getTime() - hoje.getTime()) / 86400000)
    if (dias >= 0 && dias <= 30) {
      alertas.push({
        severidade: 'media',
        icon: RefreshCw,
        titulo: `Reajuste do contrato ${c.number} em ${dias}d`,
        detalhe: 'Aniversário contratual se aproximando — prepare o reajuste',
        href: `/contratos/${c.id}`,
      })
    }
  }

  // ── Regra 3: faturamento parado (ativos alocados sem medição do mês anterior) ──
  const contratosComAtivos = new Map<string, { number: string; name: string }>()
  for (const a of alocacoesAtivas) {
    if (!contratosComAtivos.has(a.contratoId)) {
      contratosComAtivos.set(a.contratoId, { number: a.contrato.number, name: a.contrato.name })
    }
  }
  if (contratosComAtivos.size > 0) {
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const anoRef = mesAnterior.getFullYear()
    const mesRef = mesAnterior.getMonth() + 1
    const medicoesMesAnterior = await prisma.medicaoLocacao.findMany({
      where: { competenciaAno: anoRef, competenciaMes: mesRef, contratoId: { in: Array.from(contratosComAtivos.keys()) } },
      select: { contratoId: true },
    })
    const comMedicao = new Set(medicoesMesAnterior.map((m) => m.contratoId))
    for (const [cid, info] of Array.from(contratosComAtivos.entries())) {
      if (!comMedicao.has(cid)) {
        alertas.push({
          severidade: 'alta',
          icon: Receipt,
          titulo: `Faturamento parado: ${info.number}`,
          detalhe: `Tem ativos alocados mas sem medição de ${String(mesRef).padStart(2, '0')}/${anoRef} — dinheiro não faturado`,
          href: `/frota/medicoes`,
        })
      }
    }
  }

  // ── Regra 4: SLA interárea prestes a vencer (48h) ──────────────────────────
  for (const d of slaRisco) {
    const horas = d.slaDeadline ? Math.ceil((new Date(d.slaDeadline).getTime() - hoje.getTime()) / 3600000) : null
    alertas.push({
      severidade: horas != null && horas <= 12 ? 'alta' : 'media',
      icon: ArrowRightLeft,
      titulo: `Aceite interárea vence em ${horas}h`,
      detalhe: `"${d.title}" (${d.area?.name ?? ''}) ainda não foi aceita`,
      href: `/relatorio-interarea`,
    })
  }

  // Ordena: alta severidade primeiro
  alertas.sort((a, b) => (a.severidade === 'alta' ? 0 : 1) - (b.severidade === 'alta' ? 0 : 1))

  if (alertas.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 flex items-center gap-2">
        <Radar className="w-4 h-4 text-white" />
        <h2 className="text-sm font-semibold text-white">Alertas preditivos — riscos antes de estourar</h2>
        <span className="ml-auto text-xs font-medium text-white/90 bg-white/20 px-2 py-0.5 rounded-full">
          {alertas.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {alertas.slice(0, 8).map((a, i) => {
          const Icon = a.icon
          const alta = a.severidade === 'alta'
          return (
            <Link key={i} href={a.href} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${alta ? 'bg-red-50' : 'bg-amber-50'}`}>
                <Icon className={`w-4 h-4 ${alta ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{a.titulo}</p>
                <p className="text-xs text-gray-500">{a.detalhe}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${alta ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'}`}>
                {alta ? 'Alto' : 'Médio'}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
