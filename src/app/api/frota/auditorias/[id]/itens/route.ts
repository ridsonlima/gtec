import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/auditorias/[id]/itens  — registra item do checklist por ativo
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const visita = await prisma.auditoriaVisita.findUnique({ where: { id: params.id } })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (visita.status !== 'em_andamento')
    return apiError('Inicie a visita antes de registrar itens', 400)

  const podeRegistrar =
    ['master', 'admin', 'manager', 'supervisor'].includes(session.user.role) ||
    visita.auditorId === session.user.id
  if (!podeRegistrar) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { ativoId, categoria, descricao, conformidade, fotoKey, observacao } = body

  if (!ativoId || !categoria || !descricao || !conformidade)
    return apiError('ativoId, categoria, descricao e conformidade são obrigatórios', 400)

  const conformidadesValidas = ['ok', 'atencao', 'critica']
  if (!conformidadesValidas.includes(conformidade))
    return apiError('conformidade deve ser: ok | atencao | critica', 400)

  const ativo = await prisma.ativo.findUnique({ where: { id: ativoId } })
  if (!ativo) return apiError('Ativo não encontrado', 404)

  const item = await prisma.auditoriaItem.create({
    data: {
      visitaId: params.id,
      ativoId,
      categoria,
      descricao,
      conformidade,
      fotoKey: fotoKey || null,
      observacao: observacao || null,
    },
    include: {
      ativo: { select: { id: true, tag: true, descricao: true, categoria: true } },
      pendencia: true,
    },
  })

  // se não conforme (atencao ou critica), gera pendência automaticamente
  if (conformidade !== 'ok') {
    const prazo = new Date()
    prazo.setDate(prazo.getDate() + (conformidade === 'critica' ? 3 : 7))

    await prisma.pendenciaAuditoria.create({
      data: {
        visitaId: params.id,
        itemId: item.id,
        descricao,
        severidade: conformidade,
        prazo,
        status: 'aberta',
        responsavelId: null,
      },
    })
  }

  return apiSuccess(item, 201)
}

// PUT /api/frota/auditorias/[id]/itens  — substitui lote de itens (checklist completo)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const visita = await prisma.auditoriaVisita.findUnique({ where: { id: params.id } })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (visita.status !== 'em_andamento')
    return apiError('Inicie a visita antes de registrar itens', 400)

  const podeRegistrar =
    ['master', 'admin', 'manager', 'supervisor'].includes(session.user.role) ||
    visita.auditorId === session.user.id
  if (!podeRegistrar) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { itens } = body
  if (!Array.isArray(itens) || itens.length === 0)
    return apiError('itens é obrigatório e não pode ser vazio', 400)

  const conformidadesValidas = ['ok', 'atencao', 'critica']
  for (const item of itens) {
    if (!item.ativoId || !item.categoria || !item.descricao || !item.conformidade)
      return apiError('Cada item precisa de ativoId, categoria, descricao e conformidade', 400)
    if (!conformidadesValidas.includes(item.conformidade))
      return apiError(`conformidade inválida: ${item.conformidade}`, 400)
  }

  // remove itens anteriores e pendências geradas automaticamente
  const itensAntigos = await prisma.auditoriaItem.findMany({
    where: { visitaId: params.id },
    select: { id: true },
  })
  const idsAntigos = itensAntigos.map((i) => i.id)

  await prisma.$transaction([
    prisma.pendenciaAuditoria.deleteMany({ where: { itemId: { in: idsAntigos } } }),
    prisma.auditoriaItem.deleteMany({ where: { visitaId: params.id } }),
  ])

  // cria novos itens
  const itensCriados = await prisma.$transaction(
    itens.map((item: any) =>
      prisma.auditoriaItem.create({
        data: {
          visitaId: params.id,
          ativoId: item.ativoId,
          categoria: item.categoria,
          descricao: item.descricao,
          conformidade: item.conformidade,
          fotoKey: item.fotoKey || null,
          observacao: item.observacao || null,
        },
      })
    )
  )

  // gera pendências para não conformes
  const pendenciasData = itensCriados
    .filter((_, idx) => itens[idx].conformidade !== 'ok')
    .map((itemCriado, idx) => {
      const conformidade = itens.find((i: any) => i.ativoId === itemCriado.ativoId)?.conformidade
      const prazo = new Date()
      prazo.setDate(prazo.getDate() + (conformidade === 'critica' ? 3 : 7))
      return {
        visitaId: params.id,
        itemId: itemCriado.id,
        descricao: itemCriado.descricao,
        severidade: conformidade,
        prazo,
        status: 'aberta',
        responsavelId: null,
      }
    })

  if (pendenciasData.length > 0) {
    await prisma.pendenciaAuditoria.createMany({ data: pendenciasData })
  }

  return apiSuccess({ itens: itensCriados.length, pendencias: pendenciasData.length })
}
