import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds, canAccessArea } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em andamento',
  completed: 'Concluída', cancelled: 'Cancelada', blocked: 'Bloqueada',
}
const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa',
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse('Não autenticado', { status: 401 })

  const { searchParams } = req.nextUrl
  const areaId   = searchParams.get('areaId') ?? ''
  const contractId = searchParams.get('contractId') ?? ''
  const status   = searchParams.get('status') ?? ''
  const priority = searchParams.get('priority') ?? ''
  const isOverdue = searchParams.get('isOverdue') === 'true'
  const interarea = searchParams.get('interarea') === 'true'
  const search    = searchParams.get('search') ?? ''

  const allowedAreaIds = getUserAreaIds(session)

  // Monta filtro de área
  const areaWhere: any = {}
  if (areaId) {
    if (!canAccessArea(session, areaId)) return new NextResponse('Acesso negado', { status: 403 })
    areaWhere.areaId = areaId
  } else if (allowedAreaIds) {
    areaWhere.OR = [
      { areaId: { in: allowedAreaIds } },
      { requestingAreaId: { in: allowedAreaIds } },
    ]
  }

  // Combina todos os filtros com AND
  const andClauses: any[] = [areaWhere]
  if (contractId) andClauses.push({ contractId })
  if (status) andClauses.push({ status })
  if (priority) andClauses.push({ priority })
  if (isOverdue) andClauses.push({ isOverdue: true })
  if (interarea) andClauses.push({ requestingAreaId: { not: null } })
  if (search) andClauses.push({ title: { contains: search } })

  const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses }

  const demands = await prisma.demand.findMany({
    where,
    orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }, { dueDate: 'asc' }],
    take: 5000,
    select: {
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      isOverdue: true,
      createdAt: true,
      requestingAreaId: true,
      area:           { select: { name: true } },
      requestingArea: { select: { name: true } },
      responsible:    { select: { name: true } },
      contract:       { select: { number: true } },
    },
  })

  const headers = [
    'Título', 'Área Executora', 'Área Solicitante',
    'Prioridade', 'Status', 'Vencida', 'Prazo',
    'Responsável', 'Contrato', 'Criada em',
  ]

  const rows = demands.map((d) => [
    d.title,
    d.area.name,
    d.requestingArea?.name ?? '',
    PRIORITY_LABELS[d.priority] ?? d.priority,
    STATUS_LABELS[d.status] ?? d.status,
    d.isOverdue ? 'Sim' : 'Não',
    formatDate(d.dueDate),
    d.responsible.name,
    d.contract?.number ?? '',
    formatDate(d.createdAt),
  ])

  const csvEscape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const csvLines  = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const bom       = '﻿'

  return new NextResponse(bom + csvLines, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="demandas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
