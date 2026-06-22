import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/obras?contratoId= — dados de gestão de obra (restrições, interferências, avanço)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const contratoId = req.nextUrl.searchParams.get('contratoId') || undefined

  const contratos = await prisma.contract.findMany({
    where: { status: { in: ['active', 'at_risk', 'delayed', 'suspended'] } },
    select: { id: true, number: true, name: true },
    orderBy: { number: 'asc' },
  })

  if (!contratoId) return apiSuccess({ contratos, restricoes: [], interferencias: [], avancos: [] })

  const [restricoes, interferencias, avancos, usuarios] = await Promise.all([
    prisma.obraRestricao.findMany({
      where: { contratoId },
      orderBy: [{ status: 'asc' }, { prazo: 'asc' }],
      include: {
        responsavel: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.obraInterferencia.findMany({
      where: { contratoId },
      orderBy: [{ status: 'asc' }, { dataInicio: 'desc' }],
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.obraAvancoFisico.findMany({
      where: { contratoId },
      orderBy: { dataRef: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return apiSuccess({ contratos, restricoes, interferencias, avancos, usuarios })
}
