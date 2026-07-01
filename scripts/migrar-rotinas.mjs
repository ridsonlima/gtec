// Migração de dados: RotinaConclusao (legado) -> RotinaOcorrencia + RotinaRegistro
// Uso:
//   node scripts/migrar-rotinas.mjs           (dry-run: só conta e mostra)
//   node scripts/migrar-rotinas.mjs --apply   (grava de verdade)
// Idempotente: pode rodar de novo com segurança.

import fs from 'fs'
import { PrismaClient } from '@prisma/client'

// carrega DATABASE_URL do .env.local (fallback .env)
for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  }
}

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

function pad(n) { return String(n).padStart(2, '0') }
function isoWeekStart(year, week) {
  const jan4 = new Date(year, 0, 4)
  const jan4Dow = (jan4.getDay() + 6) % 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - jan4Dow)
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}
function periodEnd(freq, periodo) {
  if (freq === 'diaria') {
    const [y, m, d] = periodo.split('-').map(Number)
    return new Date(y, m - 1, d, 23, 59, 59, 999)
  }
  if (freq === 'mensal') {
    const [y, m] = periodo.split('-').map(Number)
    return new Date(y, m, 0, 23, 59, 59, 999)
  }
  const [yStr, wStr] = periodo.split('-W')
  const monday = isoWeekStart(Number(yStr), Number(wStr))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

async function main() {
  console.log(`\n=== Migração de rotinas (${APPLY ? 'APLICANDO' : 'DRY-RUN'}) ===\n`)

  const rotinas = await prisma.rotinaArea.findMany({ select: { id: true, frequencia: true, title: true } })
  const freqById = new Map(rotinas.map((r) => [r.id, r.frequencia]))

  const conclusoes = await prisma.rotinaConclusao.findMany()
  console.log(`Rotinas: ${rotinas.length}`)
  console.log(`Conclusões (legado) a migrar: ${conclusoes.length}`)

  const anexosLegado = await prisma.attachment.count({ where: { objectType: 'rotina_entrega' } })
  console.log(`Anexos objectType='rotina_entrega' a re-apontar: ${anexosLegado}\n`)

  let ocorrenciasCriadas = 0, registrosCriados = 0, anexosMovidos = 0, jaMigrados = 0

  for (const c of conclusoes) {
    const freq = freqById.get(c.rotinaId) ?? 'semanal'
    const prazo = periodEnd(freq, c.periodo)

    if (!APPLY) {
      const anexos = await prisma.attachment.count({ where: { objectType: 'rotina_entrega', objectId: c.id } })
      console.log(`  [${freq}] ${c.periodo} status=${c.status} texto=${c.texto ? 'sim' : 'não'} anexos=${anexos} -> ocorrência(entregue) prazo=${prazo.toISOString().slice(0,10)}`)
      continue
    }

    // 1) upsert da ocorrência (idempotente por [rotinaId, periodo])
    const ocorrencia = await prisma.rotinaOcorrencia.upsert({
      where: { rotinaId_periodo: { rotinaId: c.rotinaId, periodo: c.periodo } },
      update: {
        estado: 'entregue',
        statusFechamento: c.status,
        fechadoEm: c.concluidoEm,
        fechadoPorId: c.concluidoPorId,
        prazo,
      },
      create: {
        rotinaId: c.rotinaId,
        periodo: c.periodo,
        prazo,
        estado: 'entregue',
        statusFechamento: c.status,
        fechadoEm: c.concluidoEm,
        fechadoPorId: c.concluidoPorId,
        createdAt: c.concluidoEm,
      },
    })
    ocorrenciasCriadas++

    // 2) registro do logbook (idempotente: só cria se ainda não há registro nessa ocorrência)
    const jaTemRegistro = await prisma.rotinaRegistro.count({ where: { ocorrenciaId: ocorrencia.id } })
    const anexos = await prisma.attachment.findMany({ where: { objectType: 'rotina_entrega', objectId: c.id } })
    const precisaRegistro = Boolean(c.texto) || anexos.length > 0

    if (jaTemRegistro > 0) { jaMigrados++; continue }

    if (precisaRegistro) {
      const registro = await prisma.rotinaRegistro.create({
        data: { ocorrenciaId: ocorrencia.id, texto: c.texto ?? null, autorId: c.concluidoPorId, createdAt: c.concluidoEm },
      })
      registrosCriados++
      // 3) re-aponta anexos para o novo registro
      if (anexos.length > 0) {
        const { count } = await prisma.attachment.updateMany({
          where: { objectType: 'rotina_entrega', objectId: c.id },
          data: { objectType: 'rotina_registro', objectId: registro.id },
        })
        anexosMovidos += count
      }
    }
  }

  console.log(`\n--- Resultado ---`)
  if (!APPLY) {
    console.log(`(dry-run — nada foi gravado. Rode com --apply para aplicar.)`)
  } else {
    console.log(`Ocorrências upsertadas: ${ocorrenciasCriadas}`)
    console.log(`Registros criados: ${registrosCriados}`)
    console.log(`Anexos movidos: ${anexosMovidos}`)
    console.log(`Ocorrências já migradas (puladas): ${jaMigrados}`)
    const restam = await prisma.attachment.count({ where: { objectType: 'rotina_entrega' } })
    console.log(`Anexos 'rotina_entrega' restantes (deve ser 0): ${restam}`)
  }
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1) }).finally(() => prisma.$disconnect())
