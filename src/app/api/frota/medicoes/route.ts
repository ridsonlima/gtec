import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/frota/medicoes
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const contratoId = searchParams.get('contratoId')
  const status = searchParams.get('status')
  const ano = searchParams.get('ano')
  const mes = searchParams.get('mes')

  const where: any = {}
  if (contratoId) where.contratoId = contratoId
  if (status) where.status = status
  if (ano) where.competenciaAno = Number(ano)
  if (mes) where.competenciaMes = Number(mes)

  const medicoes = await prisma.medicaoLocacao.findMany({
    where,
    orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
    include: {
      contrato: { select: { id: true, number: true, name: true } },
      aprovador: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { itens: true } },
    },
  })

  return apiSuccess(medicoes)
}

// POST /api/frota/medicoes  — cria rascunho e pode popular itens automaticamente
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const body = await req.json()
  const { contratoId, competenciaAno, competenciaMes, itens, observacoes, moduloTipo = 'veiculo' } = body

  if (!contratoId || !competenciaAno || !competenciaMes)
    return apiError('contratoId, competenciaAno e competenciaMes são obrigatórios', 400)

  const existente = await prisma.medicaoLocacao.findFirst({
    where: {
      contratoId,
      competenciaAno: Number(competenciaAno),
      competenciaMes: Number(competenciaMes),
      moduloTipo,
    },
  })
  if (existente) return apiError('Já existe medição para esta competência neste contrato neste módulo', 409)

  const contrato = await prisma.contract.findUnique({ where: { id: contratoId } })
  if (!contrato) return apiError('Contrato não encontrado', 404)

  // Se não vieram itens explícitos, tenta popular automaticamente pelos ativos alocados
  let itensData: any[] = []

  if (itens && itens.length > 0) {
    itensData = itens.map((item: any) => ({
      ativoId: item.ativoId,
      projetoId: item.projetoId || null,
      diasAtivos: Number(item.diasAtivos),
      valorUnitario: Number(item.valorUnitario),
      totalItem: Number(item.diasAtivos) * Number(item.valorUnitario),
      observacoes: item.observacoes || null,
    }))
  } else {
    // auto-populate: ativos alocados no contrato na competência, filtrados por moduloTipo
    const alocacoesAtivas = await prisma.alocacaoAtivo.findMany({
      where: {
        contratoId,
        ativo: { tipo: moduloTipo === 'equipamento' ? 'equipamento' : 'veiculo' },
        dataInicio: {
          lte: new Date(Number(competenciaAno), Number(competenciaMes) - 1, 31),
        },
        OR: [
          { dataFim: null },
          {
            dataFim: {
              gte: new Date(Number(competenciaAno), Number(competenciaMes) - 1, 1),
            },
          },
        ],
      },
      include: { ativo: true },
    })

    const diasNoMes = new Date(Number(competenciaAno), Number(competenciaMes), 0).getDate()

    itensData = alocacoesAtivas.map((aloc) => {
      const inicioMes = new Date(Number(competenciaAno), Number(competenciaMes) - 1, 1)
      const fimMes = new Date(Number(competenciaAno), Number(competenciaMes) - 1, diasNoMes)
      const dataInicio = aloc.dataInicio > inicioMes ? aloc.dataInicio : inicioMes
      const dataFim = aloc.dataFim && aloc.dataFim < fimMes ? aloc.dataFim : fimMes
      const dias = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const diasAtivos = Math.max(1, Math.min(dias, diasNoMes))
      const valorDiario = aloc.ativo.valorLocacaoMensal / diasNoMes

      return {
        ativoId: aloc.ativoId,
        projetoId: aloc.projetoId || null,
        diasAtivos,
        valorUnitario: Number(valorDiario.toFixed(2)),
        totalItem: Number((diasAtivos * valorDiario).toFixed(2)),
        observacoes: null,
      }
    })
  }

  const totalGeral = itensData.reduce((acc, i) => acc + i.totalItem, 0)

  const medicao = await prisma.medicaoLocacao.create({
    data: {
      contratoId,
      competenciaAno: Number(competenciaAno),
      competenciaMes: Number(competenciaMes),
      status: 'rascunho',
      moduloTipo,
      totalGeral: Number(totalGeral.toFixed(2)),
      observacoes: observacoes || null,
      createdById: session.user.id,
      itens: { create: itensData },
    },
    include: {
      itens: {
        include: {
          ativo: { select: { id: true, tag: true, descricao: true, categoria: true } },
          projeto: { select: { id: true, name: true } },
        },
      },
      contrato: { select: { id: true, number: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(medicao, 201)
}
