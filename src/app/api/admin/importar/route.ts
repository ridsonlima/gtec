import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { parseCsv } from '@/lib/csv'
import bcrypt from 'bcryptjs'

type LinhaResultado = { linha: number; status: 'criado' | 'erro' | 'ignorado'; mensagem: string; chave?: string }

const ROLES_VALIDOS = ['master', 'admin', 'director', 'manager', 'supervisor', 'viewer']
const TIPOS_ATIVO = ['veiculo', 'equipamento']

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k]
  }
  return ''
}

function parseNumber(v: string): number | null {
  if (!v) return null
  const n = Number(v.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { tipo, csv } = body
  if (!csv || typeof csv !== 'string') return apiError('CSV vazio', 400)
  if (!['usuarios', 'ativos', 'contratos'].includes(tipo)) return apiError('Tipo inválido', 400)

  const rows = parseCsv(csv)
  if (rows.length === 0) return apiError('Nenhuma linha encontrada no CSV', 400)

  const resultados: LinhaResultado[] = []
  let criados = 0

  // ─── USUÁRIOS ───────────────────────────────────────────────────────────────
  if (tipo === 'usuarios') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const linha = i + 2 // +2: header + 1-index
      const nome  = pick(row, 'nome', 'name')
      const email = pick(row, 'email', 'e-mail').toLowerCase()
      const role  = pick(row, 'perfil', 'role', 'papel') || 'viewer'
      const senha = pick(row, 'senha', 'password') || 'cdg@2026'

      if (!nome || !email) { resultados.push({ linha, status: 'erro', mensagem: 'Nome e e-mail são obrigatórios' }); continue }
      if (!ROLES_VALIDOS.includes(role)) { resultados.push({ linha, status: 'erro', mensagem: `Perfil inválido: ${role}` }); continue }

      const existe = await prisma.user.findUnique({ where: { email } })
      if (existe) { resultados.push({ linha, status: 'ignorado', mensagem: 'E-mail já cadastrado', chave: email }); continue }

      try {
        const passwordHash = await bcrypt.hash(String(senha), 12)
        await prisma.user.create({ data: { name: nome, email, passwordHash, role, isActive: true } })
        criados++
        resultados.push({ linha, status: 'criado', mensagem: 'Usuário criado', chave: email })
      } catch (e) {
        resultados.push({ linha, status: 'erro', mensagem: e instanceof Error ? e.message : 'Erro ao criar' })
      }
    }
  }

  // ─── ATIVOS ───────────────────────────────────────────────────────────────
  if (tipo === 'ativos') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const linha = i + 2
      const tag       = pick(row, 'tag')
      const tipoAtivo = pick(row, 'tipo').toLowerCase()
      const descricao = pick(row, 'descricao', 'descrição', 'description')
      const valor     = parseNumber(pick(row, 'valor', 'valorlocacaomensal', 'valor_locacao', 'valormensal'))

      if (!tag || !tipoAtivo || !descricao || valor == null) {
        resultados.push({ linha, status: 'erro', mensagem: 'Obrigatórios: tag, tipo, descricao, valor' }); continue
      }
      if (!TIPOS_ATIVO.includes(tipoAtivo)) { resultados.push({ linha, status: 'erro', mensagem: `Tipo inválido: ${tipoAtivo} (use veiculo ou equipamento)` }); continue }

      const existe = await prisma.ativo.findUnique({ where: { tag } })
      if (existe) { resultados.push({ linha, status: 'ignorado', mensagem: 'TAG já cadastrada', chave: tag }); continue }

      try {
        await prisma.ativo.create({
          data: {
            tag,
            tipo: tipoAtivo,
            descricao,
            categoria: pick(row, 'categoria') || 'Geral',
            marca: pick(row, 'marca') || null,
            modelo: pick(row, 'modelo') || null,
            placa: pick(row, 'placa') || null,
            numeroserie: pick(row, 'numeroserie', 'numero_serie', 'serie') || null,
            valorLocacaoMensal: valor,
            status: 'disponivel',
          },
        })
        criados++
        resultados.push({ linha, status: 'criado', mensagem: 'Ativo criado', chave: tag })
      } catch (e) {
        resultados.push({ linha, status: 'erro', mensagem: e instanceof Error ? e.message : 'Erro ao criar' })
      }
    }
  }

  // ─── CONTRATOS ───────────────────────────────────────────────────────────────
  if (tipo === 'contratos') {
    const areas = await prisma.area.findMany({ select: { id: true, code: true, name: true } })
    const areaByCode = new Map(areas.map((a) => [a.code.toLowerCase(), a.id]))
    const areaByName = new Map(areas.map((a) => [a.name.toLowerCase(), a.id]))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const linha = i + 2
      const numero  = pick(row, 'numero', 'número', 'number')
      const nome    = pick(row, 'nome', 'name')
      const cliente = pick(row, 'cliente', 'client')
      const areaRef = pick(row, 'area', 'área', 'area_code', 'codigo_area')
      const valor   = parseNumber(pick(row, 'valor', 'estimatedvalue', 'valor_estimado'))

      if (!numero || !nome || !cliente || !areaRef) {
        resultados.push({ linha, status: 'erro', mensagem: 'Obrigatórios: numero, nome, cliente, area' }); continue
      }
      const areaId = areaByCode.get(areaRef.toLowerCase()) ?? areaByName.get(areaRef.toLowerCase())
      if (!areaId) { resultados.push({ linha, status: 'erro', mensagem: `Área não encontrada: ${areaRef}` }); continue }

      try {
        await prisma.contract.create({
          data: {
            areaId,
            number: numero,
            name: nome,
            client: cliente,
            estimatedValue: valor,
            status: 'active',
            executionModality: 'own_crew',
          },
        })
        criados++
        resultados.push({ linha, status: 'criado', mensagem: 'Contrato criado', chave: numero })
      } catch (e) {
        resultados.push({ linha, status: 'erro', mensagem: e instanceof Error ? e.message : 'Erro ao criar' })
      }
    }
  }

  return apiSuccess({
    total: rows.length,
    criados,
    ignorados: resultados.filter((r) => r.status === 'ignorado').length,
    erros: resultados.filter((r) => r.status === 'erro').length,
    resultados,
  })
}
