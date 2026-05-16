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
      partner: true,
      medicoes: {
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        include: { adiantamentos: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = contracts.map((c) => {
    const percentual = c.partner?.percentageGlobal ?? 0

    const totais = c.medicoes.reduce(
      (acc, m) => {
        const totalAdiant = m.adiantamentos.reduce((s, a) => s + a.valor, 0)
        const repasse = (m.valorFaturado * percentual) / 100
        return {
          produzido: acc.produzido + m.valorProduzido,
          aprovado: acc.aprovado + m.valorAprovado,
          faturado: acc.faturado + m.valorFaturado,
          contestacao: acc.contestacao + (m.valorProduzido - m.valorAprovado),
          prateleira: acc.prateleira + (m.valorAprovado - m.valorFaturado),
          repasse_bruto: acc.repasse_bruto + repasse,
          adiantamentos: acc.adiantamentos + totalAdiant,
          repasse_liquido: acc.repasse_liquido + (repasse - totalAdiant),
        }
      },
      { produzido: 0, aprovado: 0, faturado: 0, contestacao: 0, prateleira: 0, repasse_bruto: 0, adiantamentos: 0, repasse_liquido: 0 }
    )

    const ultimaMedicao = c.medicoes[0] ?? null

    return {
      id: c.id,
      number: c.number,
      name: c.name,
      status: c.status,
      area: c.area,
      responsible: c.responsible,
      partner: c.partner,
      totalMedicoes: c.medicoes.length,
      ultimaCompetencia: ultimaMedicao
        ? { ano: ultimaMedicao.competenciaAno, mes: ultimaMedicao.competenciaMes }
        : null,
      totais,
    }
  })

  return apiSuccess(result)
}
