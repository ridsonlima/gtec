import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/frota/ordens-servico/[id]/updates
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const updates = await prisma.ordemServicoUpdate.findMany({
    where: { osId: params.id },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true } } },
  })

  return apiSuccess(updates)
}

// POST /api/frota/ordens-servico/[id]/updates
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const os = await prisma.ordemServico.findUnique({ where: { id: params.id } })
  if (!os) return apiError('OS não encontrada', 404)
  if (os.status === 'cancelada') return apiError('OS cancelada não pode ser atualizada', 400)

  const body = await req.json()
  const { content, tipo = 'atualizacao', custo } = body

  if (!content?.trim()) return apiError('Conteúdo obrigatório', 400)

  const TIPOS_VALIDOS = ['atualizacao', 'problema_encontrado', 'peca_substituida', 'observacao']
  if (!TIPOS_VALIDOS.includes(tipo)) return apiError('Tipo inválido', 400)

  const update = await prisma.ordemServicoUpdate.create({
    data: {
      osId: params.id,
      authorId: session.user.id,
      content: content.trim(),
      tipo,
      custo: custo != null ? Number(custo) : null,
    },
    include: { author: { select: { id: true, name: true } } },
  })

  // Se informou custo adicional, acumula no custo total da OS
  if (custo != null && Number(custo) > 0) {
    const custoAtual = os.custo ?? 0
    await prisma.ordemServico.update({
      where: { id: params.id },
      data: { custo: custoAtual + Number(custo) },
    })
  }

  return apiSuccess(update, 201)
}
