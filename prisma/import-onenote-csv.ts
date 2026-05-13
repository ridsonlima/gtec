import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()
const DEFAULT_CSV = 'C:/Users/ridson.lima/Downloads/base_contratos_estruturada_v2.csv'
const DEFAULT_AREA_CODE = 'OBRAS_TERC'
const DEFAULT_RESPONSIBLE_EMAIL = 'david.santos@cdg.eng.br'
const DEFAULT_START_DATE = new Date('2026-01-01T00:00:00.000Z')
const DEFAULT_END_DATE = new Date('2026-12-31T00:00:00.000Z')

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      if (row.some((v) => v.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const headers = rows.shift()?.map((h) => h.trim()) ?? []
  return rows.map((values) => Object.fromEntries(headers.map((h, idx) => [h, (values[idx] ?? '').trim()])))
}

function clean(value?: string | null) {
  if (!value) return ''
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()
  if (!trimmed || lower === 'não informado' || lower === 'nao informado') return ''
  return trimmed
}

function toPriority(value: string) {
  const v = clean(value).toLowerCase()
  if (v === 'critica') return 'critical'
  if (v === 'alta') return 'high'
  if (v === 'baixa') return 'low'
  return 'medium'
}

function toStatus(value: string, type: string) {
  const v = clean(value).toLowerCase()
  if (v === 'concluido') return 'completed'
  if (v === 'bloqueado') return 'blocked'
  if (v === 'em_andamento') return 'in_progress'
  if (type === 'evolucao') return 'completed'
  return 'pending'
}

function dueDate(rowDate: string) {
  const dateText = clean(rowDate).split(';')[0]?.trim()
  const match = dateText?.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!match) return DEFAULT_END_DATE

  const day = Number(match[1])
  const month = Number(match[2]) - 1
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
  const date = new Date(Date.UTC(year, month, day))
  return Number.isNaN(date.getTime()) ? DEFAULT_END_DATE : date
}

function originFor(type: string) {
  if (type === 'risco') return 'audit'
  if (type === 'decisao') return 'director'
  if (type === 'evolucao') return 'report'
  return 'manager'
}

function buildDetails(row: Record<string, string>, includePrintReference = false) {
  const description = clean(row.descricao) || clean(row.titulo)
  const evidence = clean(row.evidencia_mencionada)
  const source = clean(row.arquivo_origem)
  return [
    description,
    evidence ? `Evidencia mencionada: ${evidence}` : '',
    includePrintReference && source ? `Referencia de origem: ${source}` : '',
  ].filter(Boolean).join('\n\n')
}

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV
  if (!fs.existsSync(csvPath)) throw new Error(`Arquivo CSV nao encontrado: ${csvPath}`)

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  if (!rows.length) throw new Error('CSV sem linhas para importar')

  const area = await prisma.area.findUnique({ where: { code: DEFAULT_AREA_CODE } })
  if (!area) throw new Error('Area Obras Terceirizadas nao encontrada. Rode npm.cmd run db:reset:clean primeiro.')

  const responsible = await prisma.user.findUnique({ where: { email: DEFAULT_RESPONSIBLE_EMAIL } })
  if (!responsible) throw new Error('Usuario David nao encontrado. Rode npm.cmd run db:reset:clean primeiro.')

  const creator = await prisma.user.findFirst({ where: { role: 'master' }, orderBy: { createdAt: 'asc' } })
  if (!creator) throw new Error('Usuario master nao encontrado')

  const contractByName = new Map<string, string>()
  const historyDemandByContract = new Map<string, string>()
  let contractsCreated = 0
  let demandsCreated = 0
  let historyItemsCreated = 0

  for (const row of rows) {
    const contractName = clean(row.contrato_nome) || 'Contrato sem nome'
    let contractId = contractByName.get(contractName)

    if (!contractId) {
      const existing = await prisma.contract.findFirst({ where: { name: contractName } })
      const contract = existing ?? await prisma.contract.create({
        data: {
          areaId: area.id,
          number: clean(row.contrato_numero) || `IMPORT-${contractsCreated + 1}`,
          name: contractName,
          client: clean(row.cliente) || 'A ajustar',
          description: 'Importado do CSV estruturado do OneNote. Dados cadastrais podem ser ajustados no sistema.',
          startDate: DEFAULT_START_DATE,
          endDate: DEFAULT_END_DATE,
          responsibleId: responsible.id,
          status: 'active',
        },
      })
      if (!existing) contractsCreated++
      contractId = contract.id
      contractByName.set(contractName, contractId)
    }

    const type = clean(row.tipo_registro).toLowerCase() || 'observacao'
    const title = clean(row.titulo) || `${type} - ${contractName}`

    if (['evolucao', 'observacao', 'evidencia'].includes(type)) {
      let historyDemandId = historyDemandByContract.get(contractId)
      if (!historyDemandId) {
        const historyDemand = await prisma.demand.create({
          data: {
            areaId: area.id,
            contractId,
            title: `Historico importado - ${contractName}`.slice(0, 240),
            context: 'Registros historicos importados do OneNote. Use como base de consulta e ajuste conforme necessario.',
            responsibleId: responsible.id,
            createdById: creator.id,
            status: 'in_progress',
            priority: 'medium',
            dueDate: DEFAULT_END_DATE,
            origin: 'manager',
            isOverdue: false,
          },
        })
        historyDemandId = historyDemand.id
        historyDemandByContract.set(contractId, historyDemandId)
        demandsCreated++
      }

      await prisma.demandUpdate.create({
        data: {
          demandId: historyDemandId,
          authorId: responsible.id,
          content: [`[${type.toUpperCase()}] ${title}`, buildDetails(row, false)].filter(Boolean).join('\n\n'),
          statusBefore: null,
          statusAfter: null,
          createdAt: dueDate(row.data),
        },
      })
      historyItemsCreated++
      continue
    }

    await prisma.demand.create({
      data: {
        areaId: area.id,
        contractId,
        title: title.slice(0, 240),
        context: buildDetails(row, false),
        responsibleId: responsible.id,
        createdById: creator.id,
        status: toStatus(row.status, type),
        priority: toPriority(row.prioridade),
        dueDate: dueDate(row.data),
        origin: originFor(type),
        isOverdue: false,
      },
    })
    demandsCreated++
  }

  console.log('Importacao concluida sem criar Reports a partir do CSV.')
  console.log(`Contratos criados: ${contractsCreated}`)
  console.log(`Demandas criadas: ${demandsCreated}`)
  console.log(`Itens historicos criados: ${historyItemsCreated}`)
}

main()
  .catch((e) => {
    console.error('Erro na importacao:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
