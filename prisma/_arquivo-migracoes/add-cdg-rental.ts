/**
 * Migração: Adiciona área "CDG Rental" ao banco
 *
 * Execução: npx tsx prisma/add-cdg-rental.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.area.findUnique({ where: { code: 'CDG_RENTAL' } })
  if (existing) {
    console.log('✅ Área CDG Rental já existe (id:', existing.id + ')')
    return
  }

  const area = await prisma.area.create({
    data: {
      name: 'CDG Rental',
      code: 'CDG_RENTAL',
      isOperational: true,
      description: 'Gestão de frota e equipamentos locados',
      sortOrder: 60,
    },
  })

  console.log('✅ Área criada:', area.name, '(id:', area.id + ')')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
