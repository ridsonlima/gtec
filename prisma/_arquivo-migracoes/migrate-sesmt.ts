/**
 * Migração: SESMT → Container com sub-áreas
 *
 * 1. Atualiza a área SESMT para ser um container (sem operação direta)
 * 2. Cria sub-área "Meio Ambiente" (SESMT_MA)
 * 3. Cria sub-área "Seg. do Trab." (SESMT_SEG)
 * 4. Move todos os demands existentes → Meio Ambiente
 * 5. Move todos os reports existentes → Meio Ambiente
 *
 * Execução: npx tsx prisma/migrate-sesmt.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando migração: SESMT como container...\n')

  // 1. Buscar área SESMT atual
  const sesmtArea = await prisma.area.findUnique({ where: { code: 'SESMT' } })
  if (!sesmtArea) {
    console.error('❌ Área SESMT não encontrada. Abortando.')
    process.exit(1)
  }
  console.log(`✅ Área encontrada: "${sesmtArea.name}" (id: ${sesmtArea.id})`)

  // 2. Atualizar SESMT para container (nome e descrição)
  const sesmt = await prisma.area.update({
    where: { id: sesmtArea.id },
    data: {
      name: 'SESMT',
      description: 'Segurança e Saúde no Trabalho e Meio Ambiente',
      isOperational: false,
    },
  })
  console.log(`✅ Área atualizada: "${sesmt.name}"`)

  // 3. Criar sub-área Meio Ambiente
  const meioAmbiente = await prisma.area.create({
    data: {
      name: 'Meio Ambiente',
      code: 'SESMT_MA',
      parentId: sesmt.id,
      isOperational: false,
      description: 'Gestão ambiental, licenciamentos e conformidade',
      sortOrder: 41,
    },
  })
  console.log(`✅ Sub-área criada: "${meioAmbiente.name}" (id: ${meioAmbiente.id})`)

  // 4. Criar sub-área Segurança do Trabalho
  const segTrabalho = await prisma.area.create({
    data: {
      name: 'Seg. do Trab.',
      code: 'SESMT_SEG',
      parentId: sesmt.id,
      isOperational: false,
      description: 'Segurança do trabalho, EPIs e prevenção de acidentes',
      sortOrder: 42,
    },
  })
  console.log(`✅ Sub-área criada: "${segTrabalho.name}" (id: ${segTrabalho.id})`)

  // 5. Mover todos os demands existentes → Meio Ambiente
  const demandsMovidos = await prisma.demand.updateMany({
    where: { areaId: sesmt.id },
    data: { areaId: meioAmbiente.id },
  })
  console.log(`✅ ${demandsMovidos.count} demand(s) movida(s) → Meio Ambiente`)

  // 6. Mover todos os reports existentes → Meio Ambiente
  const reportsMovidos = await prisma.report.updateMany({
    where: { areaId: sesmt.id },
    data: { areaId: meioAmbiente.id },
  })
  console.log(`✅ ${reportsMovidos.count} report(s) movido(s) → Meio Ambiente`)

  // 7. Verificar demandas requestingAreaId (interárea)
  const interareaAtualizado = await prisma.demand.updateMany({
    where: { requestingAreaId: sesmt.id },
    data: { requestingAreaId: meioAmbiente.id },
  })
  if (interareaAtualizado.count > 0) {
    console.log(`✅ ${interareaAtualizado.count} demand(s) interárea atualizada(s) → Meio Ambiente`)
  }

  console.log('\n🎉 Migração concluída com sucesso!')
  console.log(`   SESMT (container) id: ${sesmt.id}`)
  console.log(`   Meio Ambiente id:     ${meioAmbiente.id}`)
  console.log(`   Seg. do Trab. id:     ${segTrabalho.id}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro na migração:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
