import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/medicoes/[id]/itens  — adiciona item à medição
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (!['rascunho', 'rejeitada'].includes(medicao.status))
    return apiError('Não é possível editar itens neste status', 400)

  const body = await req.json()
  if (!body.ativoId || body.diasAtivos == null || body.valorUnitario == null)
    return apiError('ativoId, diasAtivos e valorUnitario são obrigatórios', 400)

  const ativo = await prisma.ativo.findUnique({ where: { id: body.ativoId } })
  if (!ativo) return apiError('Ativo não encontrado', 404)

  const totalItem = Number(body.diasAtivos) * Number(body.valorUnitario)

  const item = await prisma.medicaoLocacaoItem.create({
    data: {
      medicaoId: params.id,
      ativoId: body.ativoId,
      projetoId: body.projetoId || null,
      diasAtivos: Number(body.diasAtivos),
      valorUnitario: Number(body.valorUnitario),
      totalItem: Number(totalItem.toFixed(2)),
      observacoes: body.observacoes || null,
    },
    include: {
      ativo: { select: { id: true, tag: true, descricao: true, categoria: true } },
      projeto: { select: { id: true, name: true } },
    },
  })

  // recalcula total
  const todosItens = await prisma.medicaoLocacaoItem.findMany({ where: { medicaoId: params.id } })
  const novoTotal = todosItens.reduce((acc, i) => acc + i.totalItem, 0)
  await prisma.medicaoLocacao.update({
    where: { id: params.id },
    data: { totalGeral: Number(novoTotal.toFixed(2)) },
  })

  return apiSuccess(item, 201)
}

// PUT /api/frota/medicoes/[id]/itens  — substitui todos os itens (bulk replace)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const medicao = await prisma.medicaoLocacao.findUnique({ where: { id: params.id } })
  if (!medicao) return apiError('Medição não encontrada', 404)
  if (!['rascunho', 'rejeitada'].includes(medicao.status))
    return apiError('Não é possível editar itens neste status', 400)

  const body = await req.json()
  const { itens } = body
  if (!Array.isArray(itens)) return apiError('itens deve ser um array', 400)

  const itensData = itens.map((item: any) => ({
    medicaoId: params.id,
    ativoId: item.ativoId,
    projetoId: item.projetoId || null,
    diasAtivos: Number(item.diasAtivos),
    valorUnitario: Number(item.valorUnitario),
    totalItem: Number((Number(item.diasAtivos) * Number(item.valorUnitario)).toFixed(2)),
    observacoes: item.observacoes || null,
  }))

  const totalGeral = itensData.reduce((acc, i) => acc + i.totalItem, 0)

  await prisma.$transaction([
    prisma.medicaoLocacaoItem.deleteMany({ where: { medicaoId: params.id } }),
    prisma.medicaoLocacaoItem.createMany({ data: itensData }),
    prisma.medicaoLocacao.update({
      where: { id: params.id },
      data: { totalGeral: Number(totalGeral.toFixed(2)) },
    }),
  ])

  const atualizada = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: {
      itens: {
        include: {
          ativo: { select: { id: true, tag: true, descricao: true, categoria: true } },
          projeto: { select: { id: true, name: true } },
        },
      },
    },
  })

  return apiSuccess(atualizada)
}
