import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const salaTecnicaId = 'b23d0b97-ed09-439c-920c-bec940a7044b'
  const planejamentoId = 'ee80bbb8-c8f2-48d1-b213-dad725d44680'
  const orcamentoId = '95097e58-1e3c-498e-913b-54674b635707'

  const all = await prisma.demand.findMany({
    where: { areaId: { in: [salaTecnicaId, planejamentoId, orcamentoId] } },
    select: { id: true, title: true, areaId: true },
  })

  for (const d of all) {
    const areaLabel = d.areaId === salaTecnicaId ? 'Sala Técnica'
      : d.areaId === planejamentoId ? 'Planejamento'
      : 'Orçamento'
    console.log(`[${areaLabel}] "${d.title}"`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
