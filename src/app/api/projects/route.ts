import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove, isDirector } from '@/lib/permissions'
import { CreateProjectSchema } from '@/schemas/project.schema'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem acesso', 403)

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const contractId = searchParams.get('contractId')
  const dir    = isDirector(session.user.role)

  const projects = await prisma.project.findMany({
    where: {
      // ao filtrar por contrato, mostra todos os projetos da obra (não restringe por responsável)
      ...(!dir && !contractId ? { responsibleId: session.user.id } : {}),
      ...(contractId ? { contractId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      responsibleUser: { select: { id: true, name: true } },
      milestones: { select: { id: true, isCompleted: true } },
      _count: { select: { updates: true, demands: true } },
    },
  })

  return apiSuccess(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem acesso', 403)

  const body   = await req.json()
  const parsed = CreateProjectSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.errors)

  const d = parsed.data
  const project = await prisma.project.create({
    data: {
      name:            d.name,
      objective:       d.objective ?? null,
      contractId:      d.contractId ?? null,
      responsibleId:   d.responsibleId,
      status:          d.status,
      riskLevel:       d.riskLevel,
      startDate:       d.startDate       ? new Date(d.startDate)       : null,
      expectedEndDate: d.expectedEndDate ? new Date(d.expectedEndDate) : null,
    },
  })

  await audit({ userId: session.user.id, action: 'project.create', objectType: 'project', objectId: project.id, metadata: { name: project.name } })
  return apiSuccess(project, 201)
}
