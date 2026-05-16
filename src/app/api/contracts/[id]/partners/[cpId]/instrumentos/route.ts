import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'

const TIPOS_VALIDOS = ['gestao_obra', 'locacao_maquinas', 'nota_debito', 'outro']

export async function POST(req: NextRequest, { params }: { params: { id: string; cpId: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissão', 403)

  const cp = await prisma.contractPartner.findUnique({
    where: { id: params.cpId },
    include: { contract: { select: { areaId: true } }, instrumentos: true },
  })
  if (!cp || cp.contractId !== params.id) return apiError('Vínculo não encontrado', 404)
  if (!canAccessArea(session, cp.contract.areaId)) return apiError('Sem acesso', 403)

  const body = await req.json()
  if (!TIPOS_VALIDOS.includes(body.tipo)) return apiError('Tipo de instrumento inválido', 400)

  // nota_debito só pode haver um e não tem % fixo
  if (body.tipo === 'nota_debito') {
    const jaTemNotaDebito = cp.instrumentos.some((i) => i.tipo === 'nota_debito')
    if (jaTemNotaDebito) return apiError('Já existe uma nota de débito neste vínculo', 400)
  }

  const instrumento = await prisma.instrumentoFiscal.create({
    data: {
      contractPartnerId: params.cpId,
      tipo: body.tipo,
      descricao: body.descricao || null,
      percentage: body.tipo === 'nota_debito' ? null : Number(body.percentage),
    },
  })

  return apiSuccess(instrumento, 201)
}
