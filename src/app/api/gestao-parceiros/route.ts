import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { getUserAreaIds } from '@/lib/permissions'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

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

  const result = contracts.map((c) => {
    const ultimaMedicao = c.medicoes[0] ?? null

    const totaisMedicoes = c.medicoes.reduce(
      (acc, m) => ({
        produzido: acc.produzido + m.valorProduzido,
        aprovado: acc.aprovado + m.valorAprovado,
        faturado: acc.faturado + m.valorFaturado,
        contestacao: acc.contestacao + (m.valorProduzido - m.valorAprovado),
        prateleira: acc.prateleira + (m.valorAprovado - m.valorFaturado),
      }),
      { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0 }
    )

    // repasse por parceiro
    const parceiros = c.contractPartners.map((cp) => {
      const pct = cp.percentageTotal
      const repasse_bruto = (totaisMedicoes.faturado * pct) / 100

      // soma adiantamentos de todas as medições (para este parceiro não há distinção — é do contrato)
      const totalAdiantamentos = c.medicoes.reduce(
        (s, m) => s + m.adiantamentos.reduce((a, ad) => a + ad.valor, 0), 0
      )

      // instrumentos com % calculado
      const somaInstrFixos = cp.instrumentos
        .filter((i) => i.tipo !== 'nota_debito' && i.percentage != null)
        .reduce((s, i) => s + (i.percentage ?? 0), 0)

      const instrumentos = cp.instrumentos.map((i) => {
        const pctInstr = i.tipo === 'nota_debito' ? (pct - somaInstrFixos) : (i.percentage ?? 0)
        return {
          ...i,
          percentageEfetivo: pctInstr,
          valorRepasse: (totaisMedicoes.faturado * pctInstr) / 100,
        }
      })

      return {
        id: cp.id,
        empresaParceira: cp.empresaParceira,
        percentageTotal: pct,
        repasse_bruto,
        totalAdiantamentos,
        repasse_liquido: repasse_bruto - totalAdiantamentos,
        instrumentos,
      }
    })

    return {
      id: c.id,
      number: c.number,
      name: c.name,
      status: c.status,
      area: c.area,
      responsible: c.responsible,
      totalMedicoes: c.medicoes.length,
      ultimaCompetencia: ultimaMedicao
        ? { ano: ultimaMedicao.competenciaAno, mes: ultimaMedicao.competenciaMes }
        : null,
      totaisMedicoes,
      parceiros,
    }
  })

  return apiSuccess(result)
}
