import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em andamento',
  completed: 'Concluída', cancelled: 'Cancelada', blocked: 'Bloqueada',
}
const ACCEPTANCE_LABELS: Record<string, string> = {
  pending_acceptance: 'Aguardando aceite', accepted: 'Aceita', rejected: 'Rejeitada',
}
const SLA_LABELS: Record<string, string> = {
  ok: 'OK', warning: 'Atenção', breached: 'Vencido',
}
const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa',
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse('Não autenticado', { status: 401 })
  if (!isDirector(session.user.role)) return new NextResponse('Acesso negado', { status: 403 })

  const { searchParams } = req.nextUrl
  const requestingAreaId = searchParams.get('requestingAreaId') ?? ''
  const areaId           = searchParams.get('areaId') ?? ''
  const status           = searchParams.get('status') ?? ''
  const acceptanceStatus = searchParams.get('acceptanceStatus') ?? ''
  const dateFrom         = searchParams.get('dateFrom') ?? ''
  const dateTo           = searchParams.get('dateTo') ?? ''

  const demands = await prisma.demand.findMany({
    where: {
      requestingAreaId: { not: null },
      ...(requestingAreaId ? { requestingAreaId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(status ? { status } : {}),
      ...(acceptanceStatus ? { acceptanceStatus } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo + 'T23:59:59') } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      area:           { select: { name: true } },
      requestingArea: { select: { name: true } },
      responsible:    { select: { name: true } },
      acceptedBy:     { select: { name: true } },
      rejectedBy:     { select: { name: true } },
    },
  })

  const headers = [
    'Título', 'Área Solicitante', 'Área Executora', 'Prioridade',
    'Status', 'Aceite', 'SLA', 'Prazo SLA',
    'Responsável', 'Prazo', 'Criada em', 'Motivo da Rejeição',
  ]

  const rows = demands.map((d) => [
    d.title,
    d.requestingArea?.name ?? '',
    d.area.name,
    PRIORITY_LABELS[d.priority] ?? d.priority,
    STATUS_LABELS[d.status] ?? d.status,
    d.acceptanceStatus ? (ACCEPTANCE_LABELS[d.acceptanceStatus] ?? d.acceptanceStatus) : '',
    d.slaStatus ? (SLA_LABELS[d.slaStatus] ?? d.slaStatus) : '',
    d.slaDeadline ? formatDate(d.slaDeadline) : '',
    d.responsible.name,
    formatDate(d.dueDate),
    formatDate(d.createdAt),
    d.rejectionReason ?? '',
  ])

  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csvLines  = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const bom       = '﻿' // UTF-8 BOM para Excel reconhecer acentuação

  return new NextResponse(bom + csvLines, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="demandas-interarea-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
