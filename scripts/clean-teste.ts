/**
 * Remove o contrato "gfsadg" e todos os registros que contenham "teste"
 * nos campos de nome / título / número.
 *
 * Uso: npx tsx scripts/clean-teste.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ilike = (field: string) => ({ contains: 'teste', mode: 'insensitive' as const })

async function deleteCommentsCascade(objectType: string, objectIds: string[]) {
  if (!objectIds.length) return
  // Mencoes de todos os comments (pais e filhos)
  const parentComments = await prisma.comment.findMany({
    where: { objectType, objectId: { in: objectIds }, parentId: null },
    select: { id: true },
  })
  const parentIds = parentComments.map((c) => c.id)
  // Replies
  const replyComments = await prisma.comment.findMany({
    where: { parentId: { in: parentIds } },
    select: { id: true },
  })
  const replyIds = replyComments.map((c) => c.id)
  // Apaga mentions de replies e parents
  if (replyIds.length) await prisma.mention.deleteMany({ where: { commentId: { in: replyIds } } })
  if (parentIds.length) await prisma.mention.deleteMany({ where: { commentId: { in: parentIds } } })
  // Apaga replies depois parents
  if (replyIds.length) await prisma.comment.deleteMany({ where: { id: { in: replyIds } } })
  if (parentIds.length) await prisma.comment.deleteMany({ where: { id: { in: parentIds } } })
}

async function deleteDemandCascade(demandIds: string[]) {
  if (!demandIds.length) return 0
  await prisma.agendaItem.deleteMany({ where: { demandId: { in: demandIds } } })
  await prisma.evidenceRequest.deleteMany({ where: { objectType: 'demand', objectId: { in: demandIds } } })
  await prisma.attachment.deleteMany({ where: { objectType: 'demand', objectId: { in: demandIds } } })
  await deleteCommentsCascade('demand', demandIds)
  await prisma.demandCollaborator.deleteMany({ where: { demandId: { in: demandIds } } })
  await prisma.demandUpdate.deleteMany({ where: { demandId: { in: demandIds } } })
  await prisma.demandChecklistItem.deleteMany({ where: { demandId: { in: demandIds } } })
  const { count } = await prisma.demand.deleteMany({ where: { id: { in: demandIds } } })
  return count
}

async function deleteContractCascade(contractIds: string[]) {
  if (!contractIds.length) return 0

  // Demandas vinculadas ao contrato
  const demands = await prisma.demand.findMany({
    where: { contractId: { in: contractIds } },
    select: { id: true },
  })
  await deleteDemandCascade(demands.map((d) => d.id))

  // Reports vinculados
  const reports = await prisma.report.findMany({
    where: { contractId: { in: contractIds } },
    select: { id: true },
  })
  if (reports.length) {
    const reportIds = reports.map((r) => r.id)
    await prisma.agendaItem.deleteMany({ where: { reportId: { in: reportIds } } })
    await prisma.evidenceRequest.deleteMany({ where: { objectType: 'report', objectId: { in: reportIds } } })
    await prisma.attachment.deleteMany({ where: { objectType: 'report', objectId: { in: reportIds } } })
    await deleteCommentsCascade('report', reportIds)
    await prisma.reportVersion.deleteMany({ where: { reportId: { in: reportIds } } })
    await prisma.report.deleteMany({ where: { id: { in: reportIds } } })
  }

  // Demais filhos do contrato com onDelete Cascade pelo schema (prisma emula)
  await prisma.attachment.deleteMany({ where: { objectType: 'contract', objectId: { in: contractIds } } })
  await prisma.evidenceRequest.deleteMany({ where: { objectType: 'contract', objectId: { in: contractIds } } })

  const { count } = await prisma.contract.deleteMany({ where: { id: { in: contractIds } } })
  return count
}

async function main() {
  console.log('🧹 Iniciando limpeza de dados de teste...\n')

  // ── 1. Contrato "gfsadg" ────────────────────────────────────────────────────
  const gfsadg = await prisma.contract.findFirst({
    where: { number: { contains: 'gfsadg', mode: 'insensitive' } },
    select: { id: true, number: true, name: true },
  })
  if (gfsadg) {
    console.log(`  Encontrado contrato: ${gfsadg.number} — ${gfsadg.name}`)
    await deleteContractCascade([gfsadg.id])
    console.log('  ✓ Contrato gfsadg excluído (com todos os registros vinculados)\n')
  } else {
    console.log('  ℹ️  Contrato gfsadg não encontrado (talvez já excluído)\n')
  }

  // ── 2. Demandas com "teste" no título ───────────────────────────────────────
  const testeDemands = await prisma.demand.findMany({
    where: { title: ilike('title') },
    select: { id: true, title: true },
  })
  if (testeDemands.length) {
    console.log(`  Encontradas ${testeDemands.length} demanda(s) com "teste" no título:`)
    testeDemands.forEach((d) => console.log(`    - ${d.title}`))
    const n = await deleteDemandCascade(testeDemands.map((d) => d.id))
    console.log(`  ✓ ${n} demanda(s) excluída(s)\n`)
  } else {
    console.log('  ℹ️  Nenhuma demanda com "teste" no título\n')
  }

  // ── 3. Contratos com "teste" no nome ou número ──────────────────────────────
  const testeContracts = await prisma.contract.findMany({
    where: { OR: [{ name: ilike('name') }, { number: ilike('number') }] },
    select: { id: true, number: true, name: true },
  })
  if (testeContracts.length) {
    console.log(`  Encontrados ${testeContracts.length} contrato(s) com "teste":`)
    testeContracts.forEach((c) => console.log(`    - ${c.number} — ${c.name}`))
    const n = await deleteContractCascade(testeContracts.map((c) => c.id))
    console.log(`  ✓ ${n} contrato(s) excluído(s)\n`)
  } else {
    console.log('  ℹ️  Nenhum contrato com "teste" no nome/número\n')
  }

  // ── 4. Reports com "teste" no título ───────────────────────────────────────
  const testeReports = await prisma.report.findMany({
    where: { title: ilike('title') },
    select: { id: true, title: true },
  })
  if (testeReports.length) {
    console.log(`  Encontrados ${testeReports.length} report(s) com "teste" no título:`)
    testeReports.forEach((r) => console.log(`    - ${r.title}`))
    const reportIds = testeReports.map((r) => r.id)
    await prisma.agendaItem.deleteMany({ where: { reportId: { in: reportIds } } })
    await prisma.evidenceRequest.deleteMany({ where: { objectType: 'report', objectId: { in: reportIds } } })
    await prisma.attachment.deleteMany({ where: { objectType: 'report', objectId: { in: reportIds } } })
    await deleteCommentsCascade('report', reportIds)
    await prisma.reportVersion.deleteMany({ where: { reportId: { in: reportIds } } })
    const { count } = await prisma.report.deleteMany({ where: { id: { in: reportIds } } })
    console.log(`  ✓ ${count} report(s) excluído(s)\n`)
  } else {
    console.log('  ℹ️  Nenhum report com "teste" no título\n')
  }

  // ── 5. Projetos com "teste" no nome ────────────────────────────────────────
  const testeProjects = await prisma.project.findMany({
    where: { name: ilike('name') },
    select: { id: true, name: true },
  })
  if (testeProjects.length) {
    console.log(`  Encontrados ${testeProjects.length} projeto(s) com "teste" no nome:`)
    testeProjects.forEach((p) => console.log(`    - ${p.name}`))
    const projectIds = testeProjects.map((p) => p.id)
    await prisma.projectMilestone.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.projectUpdate.deleteMany({ where: { projectId: { in: projectIds } } })
    const { count } = await prisma.project.deleteMany({ where: { id: { in: projectIds } } })
    console.log(`  ✓ ${count} projeto(s) excluído(s)\n`)
  } else {
    console.log('  ℹ️  Nenhum projeto com "teste" no nome\n')
  }

  // ── 6. Pautas com "teste" no título ─────────────────────────────────────────
  const testeAgendas = await prisma.meetingAgenda.findMany({
    where: { title: ilike('title') },
    select: { id: true, title: true },
  })
  if (testeAgendas.length) {
    console.log(`  Encontradas ${testeAgendas.length} pauta(s) com "teste" no título:`)
    testeAgendas.forEach((a) => console.log(`    - ${a.title}`))
    const agendaIds = testeAgendas.map((a) => a.id)
    await prisma.agendaItem.deleteMany({ where: { agendaId: { in: agendaIds } } })
    const { count } = await prisma.meetingAgenda.deleteMany({ where: { id: { in: agendaIds } } })
    console.log(`  ✓ ${count} pauta(s) excluída(s)\n`)
  } else {
    console.log('  ℹ️  Nenhuma pauta com "teste" no título\n')
  }

  // ── 7. Empresas parceiras com "teste" no nome ───────────────────────────────
  const testeEmpresas = await prisma.empresaParceira.findMany({
    where: { name: ilike('name') },
    select: { id: true, name: true },
  })
  if (testeEmpresas.length) {
    console.log(`  Encontradas ${testeEmpresas.length} empresa(s) parceira(s) com "teste":`)
    testeEmpresas.forEach((e) => console.log(`    - ${e.name}`))
    const { count } = await prisma.empresaParceira.deleteMany({
      where: { id: { in: testeEmpresas.map((e) => e.id) } },
    })
    console.log(`  ✓ ${count} empresa(s) excluída(s)\n`)
  } else {
    console.log('  ℹ️  Nenhuma empresa parceira com "teste"\n')
  }

  console.log('✅ Limpeza concluída.')
}

main()
  .catch((e) => {
    console.error('\n❌ Erro durante a limpeza:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
