import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Limpando banco de dados...')

  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.agendaItem.deleteMany()
  await prisma.meetingAgenda.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.evidenceRequest.deleteMany()
  await prisma.comment.updateMany({ data: { parentId: null } })
  await prisma.comment.deleteMany()
  await prisma.demandUpdate.deleteMany()
  await prisma.demand.deleteMany()
  await prisma.reportVersion.deleteMany()
  await prisma.report.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.userAreaScope.deleteMany()
  await prisma.user.deleteMany()
  await prisma.area.deleteMany()

  console.log('Criando areas base...')
  const [planejamento, obrasProprias, obrasTerceirizadas, sesmt, equipamentos] = await Promise.all([
    prisma.area.create({ data: { name: 'Planejamento de Obras', code: 'PLAN', isOperational: false, description: 'Planejamento, orcamento, cronograma e contratos novos', sortOrder: 1 } }),
    prisma.area.create({ data: { name: 'Obras Proprias', code: 'OBRAS_PROP', isOperational: true, description: 'Execucao de obras com equipe propria', sortOrder: 2 } }),
    prisma.area.create({ data: { name: 'Obras Terceirizadas', code: 'OBRAS_TERC', isOperational: true, description: 'Fiscalizacao e gestao de contratos terceirizados', sortOrder: 3 } }),
    prisma.area.create({ data: { name: 'SESMT e Logistica', code: 'SESMT', isOperational: false, description: 'Seguranca do trabalho, medicina e logistica de campo', sortOrder: 4 } }),
    prisma.area.create({ data: { name: 'Equipamentos e Almoxarifado', code: 'EQUIP', isOperational: false, description: 'Frota, equipamentos e controle de materiais', sortOrder: 5 } }),
  ])

  const senhaRidson = await bcrypt.hash('gtec@2026', 12)
  const senhaDavid = await bcrypt.hash('123456', 12)

  const ridson = await prisma.user.create({
    data: {
      name: 'Ridson Lima',
      email: 'ridsonlima@gmail.com',
      passwordHash: senhaRidson,
      role: 'master',
      isActive: true,
    },
  })

  const david = await prisma.user.create({
    data: {
      name: 'David Santos',
      email: 'david.santos@cdg.eng.br',
      passwordHash: senhaDavid,
      role: 'manager',
      isActive: true,
      areaScopes: {
        create: {
          areaId: obrasTerceirizadas.id,
          canWrite: true,
          isPrimary: true,
        },
      },
    },
  })

  await prisma.auditLog.createMany({
    data: [
      { userId: ridson.id, action: 'database.clean_reset', objectType: 'system', metadata: JSON.stringify({ note: 'Banco iniciado limpo' }) },
      { userId: david.id, action: 'user.seeded', objectType: 'user', objectId: david.id, metadata: JSON.stringify({ area: 'Obras Terceirizadas' }) },
    ],
  })

  console.log('Banco limpo criado com sucesso.')
  console.log('Acessos:')
  console.log('Ridson: ridsonlima@gmail.com / gtec@2026')
  console.log('David: david.santos@cdg.eng.br / 123456')
}

main()
  .catch((e) => {
    console.error('Erro ao preparar banco limpo:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
