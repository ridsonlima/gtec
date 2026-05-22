/**
 * Apaga todos os dados operacionais mantendo:
 * - User (logins)
 * - Area (áreas cadastradas)
 * - UserAreaScope (vínculos usuário↔área)
 *
 * Uso: npx tsx scripts/clear-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Iniciando limpeza do banco de dados...\n')

  // Ordem respeitando dependências (filhos antes dos pais)
  const steps: [string, () => Promise<{ count: number }>][] = [
    ['AuditLog',          () => prisma.auditLog.deleteMany()],
    ['Notification',      () => prisma.notification.deleteMany()],
    ['Mention',           () => prisma.mention.deleteMany()],
    ['Comment (replies)', () => prisma.comment.deleteMany({ where: { parentId: { not: null } } })],
    ['Comment',           () => prisma.comment.deleteMany()],
    ['DemandCollaborator',() => prisma.demandCollaborator.deleteMany()],
    ['DemandUpdate',      () => prisma.demandUpdate.deleteMany()],
    ['EvidenceRequest',   () => prisma.evidenceRequest.deleteMany()],
    ['Attachment',        () => prisma.attachment.deleteMany()],
    ['AgendaItem',        () => prisma.agendaItem.deleteMany()],
    ['MeetingAgenda',     () => prisma.meetingAgenda.deleteMany()],
    ['ProjectUpdate',     () => prisma.projectUpdate.deleteMany()],
    ['ProjectMilestone',  () => prisma.projectMilestone.deleteMany()],
    ['Project',           () => prisma.project.deleteMany()],
    ['Demand',            () => prisma.demand.deleteMany()],
    ['ReportVersion',     () => prisma.reportVersion.deleteMany()],
    ['Report',            () => prisma.report.deleteMany()],
    ['Contract',          () => prisma.contract.deleteMany()],
  ]

  for (const [name, fn] of steps) {
    const result = await fn()
    console.log(`  ✓ ${name.padEnd(20)} ${result.count} registro(s) removido(s)`)
  }

  // Verifica o que foi mantido
  const [users, areas, scopes] = await Promise.all([
    prisma.user.count(),
    prisma.area.count(),
    prisma.userAreaScope.count(),
  ])

  console.log('\n✅ Limpeza concluída. Mantidos:')
  console.log(`  • ${users} usuário(s)`)
  console.log(`  • ${areas} área(s)`)
  console.log(`  • ${scopes} vínculo(s) usuário↔área`)
}

main()
  .catch((e) => {
    console.error('\n❌ Erro durante a limpeza:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
