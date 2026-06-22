import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

const CreateSchema = z.object({
  contratoId: z.string().uuid(),
  dataVisita: z.string().min(1),
})

// GET /api/acompanhamento?contratoId= — lista os relatórios de acompanhamento
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const contratoId = req.nextUrl.searchParams.get('contratoId') || undefined

  const relatorios = await prisma.relatorioAcompanhamento.findMany({
    where: { ...(contratoId ? { contratoId } : {}) },
    orderBy: { dataVisita: 'desc' },
    include: {
      contrato: { select: { id: true, number: true, name: true } },
      analista: { select: { id: true, name: true } },
      funcoes: { select: { funcao: true, quantidade: true } },
      ativos: { select: { tipo: true, quantidade: true } },
    },
  })

  // Contratos disponíveis para criar (obras)
  const contratos = await prisma.contract.findMany({
    where: { status: { in: ['active', 'at_risk', 'delayed', 'suspended'] } },
    select: { id: true, number: true, name: true },
    orderBy: { number: 'asc' },
  })

  return apiSuccess({ relatorios, contratos })
}

// POST /api/acompanhamento — cria um relatório (mínimo: obra + data)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const data = new Date(parsed.data.dataVisita)
  if (isNaN(data.getTime())) return apiError('Data inválida', 400)

  const created = await prisma.relatorioAcompanhamento.create({
    data: {
      contratoId: parsed.data.contratoId,
      dataVisita: data,
      analistaId: session.user.id,
      createdById: session.user.id,
    },
  })

  return apiSuccess(created, 201)
}
