import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/frota/ativos
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const tipo = searchParams.get('tipo')
  const status = searchParams.get('status')
  const categoria = searchParams.get('categoria')
  const search = searchParams.get('search')
  const contratoId = searchParams.get('contratoId')
  const projetoId = searchParams.get('projetoId')

  const where: any = {}

  if (tipo) where.tipo = tipo
  if (status) where.status = status
  if (categoria) where.categoria = categoria
  if (search) {
    where.OR = [
      { tag: { contains: search, mode: 'insensitive' } },
      { descricao: { contains: search, mode: 'insensitive' } },
      { placa: { contains: search, mode: 'insensitive' } },
      { marca: { contains: search, mode: 'insensitive' } },
      { modelo: { contains: search, mode: 'insensitive' } },
    ]
  }

  // filtro por contrato ou projeto via alocação ativa
  if (contratoId || projetoId) {
    const alocFiltro: any = { dataFim: null }
    if (contratoId) alocFiltro.contratoId = contratoId
    if (projetoId) alocFiltro.projetoId = projetoId
    const alocacoes = await prisma.alocacaoAtivo.findMany({
      where: alocFiltro,
      select: { ativoId: true },
    })
    where.id = { in: alocacoes.map((a) => a.ativoId) }
  }

  const ativos = await prisma.ativo.findMany({
    where,
    orderBy: [{ status: 'asc' }, { tag: 'asc' }],
    include: {
      alocacoes: {
        where: { dataFim: null },
        include: {
          contrato: { select: { id: true, number: true, name: true } },
          projeto: { select: { id: true, name: true } },
        },
        take: 1,
      },
      _count: {
        select: {
          ordensServico: { where: { status: { in: ['aberta', 'em_execucao'] } } },
        },
      },
    },
  })

  return apiSuccess(ativos)
}

// POST /api/frota/ativos
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const body = await req.json()

  if (!body.tag || !body.tipo || !body.descricao || body.valorLocacaoMensal == null)
    return apiError('Campos obrigatórios: tag, tipo, descricao, valorLocacaoMensal', 400)

  const tagExistente = await prisma.ativo.findUnique({ where: { tag: body.tag } })
  if (tagExistente) return apiError('TAG já cadastrada', 409)

  if (body.placa) {
    const placaExistente = await prisma.ativo.findUnique({ where: { placa: body.placa } })
    if (placaExistente) return apiError('Placa já cadastrada', 409)
  }

  const ativo = await prisma.ativo.create({
    data: {
      tag: body.tag.toUpperCase().trim(),
      tipo: body.tipo,
      categoria: body.categoria || '',
      descricao: body.descricao,
      marca: body.marca || null,
      modelo: body.modelo || null,
      anoFabricacao: body.anoFabricacao ? Number(body.anoFabricacao) : null,
      placa: body.placa ? body.placa.toUpperCase().trim() : null,
      numeroserie: body.numeroserie || null,
      valorLocacaoMensal: Number(body.valorLocacaoMensal),
      status: 'disponivel',
      observacoes: body.observacoes || null,
    },
  })

  return apiSuccess(ativo, 201)
}
