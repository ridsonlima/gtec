import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'ridsonlima@gmail.com' }, select: { id: true, name: true, email: true, role: true, isActive: true } })
  console.log('DONO:', JSON.stringify(u, null, 2))
  const masters = await prisma.user.findMany({ where: { role: 'master' }, select: { email: true, name: true } })
  console.log('MASTERS NO BANCO:', JSON.stringify(masters))
}
main().finally(() => process.exit(0))
