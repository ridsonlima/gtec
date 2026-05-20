import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, getUserAreaIds } from '@/lib/permissions'

// GET /api/contracts
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const areaId = searchParams.get('areaId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const allowedAreaIds = getUserAreaIds(session)
  const where: any = {}

  if (areaId) {
    if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)
    where.areaId = areaId
  } else if (allowedAreaIds) {
    where.areaId = { in: allowedAreaIds }
  }

  if (status) where.status = status
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { number: { contains: search } },
      { client: { contains: search } },
    ]
  }

  const contracts = await prisma.contract.findMany({
    where,
    orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
    include: {
      area: { select: { id: true, name: true, code: true } },
      responsible: { select: { id: true, name: true } },
      _count: {
        select: {
          demands: { where: { status: { notIn: ['completed', 'cancelled'] } } },
          reports: true,
          attachments: true,
        },
      },
    },
  })

  return apiSuccess(contracts)
}

// POST /api/contracts â€” apenas admin
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'director'].includes(session.user.role)) return apiError('Sem permissao', 403)

  const body = await req.json()
  const startDate = body.startDate ? new Date(body.startDate) : new Date()
  const executionDays = Number(body.executionDays || 0)
  const endDate = body.endDate
    ? new Date(body.endDate)
    : executionDays > 0
    ? new Date(startDate.getTime() + executionDays * 24 * 60 * 60 * 1000)
    : null

  const contract = await prisma.contract.create({
    data: {
      areaId: body.areaId,
      number: body.number,
      name: body.name,
      client: body.client,
      contractType: body.contractType || null,
      description: body.object || body.description,
      estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null,
      startDate,
      endDate,
      responsibleId: body.responsibleId || null,
      status: 'active',
      executionModality: body.executionModality ?? 'own_crew',
      riskNotes: body.riskNotes || null,
      proposalDate: body.proposalDate ? new Date(body.proposalDate) : null,
      readjustmentCount: body.readjustmentCount ? Number(body.readjustmentCount) : 0,
      readjustmentIndex: body.readjustmentIndex || null,
    },
  })

  return apiSuccess(contract, 201)
}

