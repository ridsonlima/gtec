/**
 * Zera todos os dados do módulo CDG RENTAL (frota):
 *   - MedicaoLocacaoItem
 *   - MedicaoLocacao
 *   - PendenciaAuditoria
 *   - AuditoriaItem
 *   - AuditoriaVisita
 *   - OrdemServico
 *   - AlocacaoAtivo
 *   - Ativo
 *
 * Mantém: Contratos, Projetos, Usuários, Áreas.
 *
 * Uso: npx tsx scripts/clear-rental.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚛 Zerando banco de dados CDG RENTAL...\n')

  const steps: [string, () => Promise<{ count: number }>][] = [
    ['MedicaoLocacaoItem', () => prisma.medicaoLocacaoItem.deleteMany()],
    ['MedicaoLocacao',     () => prisma.medicaoLocacao.deleteMany()],
    ['PendenciaAuditoria', () => prisma.pendenciaAuditoria.deleteMany()],
    ['AuditoriaItem',      () => prisma.auditoriaItem.deleteMany()],
    ['AuditoriaVisita',    () => prisma.auditoriaVisita.deleteMany()],
    ['OrdemServico',       () => prisma.ordemServico.deleteMany()],
    ['AlocacaoAtivo',      () => prisma.alocacaoAtivo.deleteMany()],
    ['Ativo',              () => prisma.ativo.deleteMany()],
  ]

  for (const [name, fn] of steps) {
    const result = await fn()
    console.log(`  ✓ ${name.padEnd(22)} ${result.count} registro(s) removido(s)`)
  }

  console.log('\n✅ Banco RENTAL zerado com sucesso.')
}

main()
  .catch((e) => {
    console.error('\n❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
