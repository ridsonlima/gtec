/**
 * Migração: Planejamento de Obras → Sala Técnica
 *
 * 1. Renomeia a área PLAN para "Sala Técnica"
 * 2. Cria sub-áreas "Planejamento" (PLAN_PLANEJ) e "Orçamento" (PLAN_ORC)
 * 3. Move demandas para as sub-áreas corretas
 *
 * Execução: npx tsx prisma/migrate-sala-tecnica.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando migração: Sala Técnica...\n')

  // 1. Buscar área PLAN atual
  const planArea = await prisma.area.findUnique({ where: { code: 'PLAN' } })
  if (!planArea) {
    console.error('❌ Área PLAN não encontrada. Abortando.')
    process.exit(1)
  }
  console.log(`✅ Área encontrada: "${planArea.name}" (id: ${planArea.id})`)

  // 2. Renomear para "Sala Técnica"
  const salaTecnica = await prisma.area.update({
    where: { id: planArea.id },
    data: {
      name: 'Sala Técnica',
      description: 'Área técnica de planejamento e orçamento de obras',
    },
  })
  console.log(`✅ Renomeada para "${salaTecnica.name}"`)

  // 3. Criar sub-área Planejamento
  const subPlanejamento = await prisma.area.create({
    data: {
      name: 'Planejamento',
      code: 'PLAN_PLANEJ',
      parentId: salaTecnica.id,
      isOperational: false,
      description: 'Cronograma, planejamento e contratos novos',
      sortOrder: 11,
    },
  })
  console.log(`✅ Sub-área criada: "${subPlanejamento.name}" (id: ${subPlanejamento.id})`)

  // 4. Criar sub-área Orçamento
  const subOrcamento = await prisma.area.create({
    data: {
      name: 'Orçamento',
      code: 'PLAN_ORC',
      parentId: salaTecnica.id,
      isOperational: false,
      description: 'Análise e elaboração de orçamentos',
      sortOrder: 12,
    },
  })
  console.log(`✅ Sub-área criada: "${subOrcamento.name}" (id: ${subOrcamento.id})`)

  // 5. Mover demandas para as sub-áreas corretas
  // Demandas verdes → Planejamento
  const demandasPlanejamento = await prisma.demand.updateMany({
    where: {
      areaId: salaTecnica.id,
      title: {
        in: ['1º Replanejamento Taquarão', '1º Aditivo Taquarão'],
      },
    },
    data: { areaId: subPlanejamento.id },
  })
  console.log(`✅ ${demandasPlanejamento.count} demanda(s) movida(s) → Planejamento`)

  // Demandas vermelhas → Orçamento
  const demandasOrcamento = await prisma.demand.updateMany({
    where: {
      areaId: salaTecnica.id,
      title: {
        in: ['Análise de Custo - Mauriti', 'Análise de Custo Adutora Cajá - Embasa'],
      },
    },
    data: { areaId: subOrcamento.id },
  })
  console.log(`✅ ${demandasOrcamento.count} demanda(s) movida(s) → Orçamento`)

  // Verificar demandas restantes na Sala Técnica (que não foram mapeadas acima)
  const restantes = await prisma.demand.count({ where: { areaId: salaTecnica.id } })
  if (restantes > 0) {
    console.log(`⚠️  ${restantes} demanda(s) ainda na "Sala Técnica" (sem mapeamento explícito)`)
  }

  console.log('\n🎉 Migração concluída com sucesso!')
  console.log(`   Sala Técnica id: ${salaTecnica.id}`)
  console.log(`   Planejamento id: ${subPlanejamento.id}`)
  console.log(`   Orçamento id:    ${subOrcamento.id}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro na migração:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
