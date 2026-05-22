import { prisma } from '@/lib/prisma'

export async function recalcFechamento(fechId: string) {
  const all = await prisma.transacao.findMany({ where: { fechamentoId: fechId } })

  const somaHip = (h: number) => all.filter((t) => t.hipotese === h).reduce((s, t) => s + t.valor, 0)

  const h3 = somaHip(3)
  const h5 = somaHip(5)
  const h6 = somaHip(6)
  const h7 = somaHip(7)
  const h8 = somaHip(8)
  const h1 = somaHip(1)
  const h2 = somaHip(2)

  // PC Contratual = H3 + H5 + H6 (base administrada pela Empresa A)
  const pcContratual = h3 + h5 + h6 > 0 ? h3 + h5 + h6 : null

  // Total saída CDG = tudo que saiu (H1+H2+H3+H5+H6+H7+H8)
  const totalSaida = h1 + h2 + h3 + h5 + h6 + h7 + h8
  // Com NF/ND = tudo exceto H2
  const totalComNF = h1 + h3 + h5 + h6 + h7 + h8

  const fech = await prisma.fechamentoMensal.findUnique({ where: { id: fechId } })
  if (!fech) return

  // ND Contratual = H5 − adiantamentos à Empresa A
  const adiant = fech.adiantEmpresaA ?? 0
  const ndContratual = h5 > 0 ? Math.max(0, h5 - adiant) : null

  // Status automático
  let status = 'aberto'
  if (fech.pcReal != null) status = 'fechado'
  else if (fech.nfAdmValor != null) status = 'nd_lancada'
  else if (pcContratual != null) status = 'pc_lancado'

  await prisma.fechamentoMensal.update({
    where: { id: fechId },
    data: {
      pcContratual,
      ndContratual,
      totalSaidaCDG: totalSaida > 0 ? totalSaida : null,
      totalComNF: totalComNF > 0 ? totalComNF : null,
      status,
    },
  })
}
