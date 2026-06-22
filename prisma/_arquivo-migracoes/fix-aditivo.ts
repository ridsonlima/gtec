import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const r = await prisma.demand.updateMany({
    where: { areaId: 'b23d0b97-ed09-439c-920c-bec940a7044b', title: '1ª Aditivo Taquarão' },
    data: { areaId: 'ee80bbb8-c8f2-48d1-b213-dad725d44680' },
  })
  console.log('Movidas:', r.count)
}
main().catch(console.error).finally(() => prisma.$disconnect())
