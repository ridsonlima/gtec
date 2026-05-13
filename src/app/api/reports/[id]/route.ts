import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'
import { notifyReportPublished } from '@/lib/notifications'

type Params = { params: { id: string } }

// GET /api/reports/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('NÃ£o autenticado', 401)

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    include: {
      area: { select: { id: true, name: true, code: true } },
      contract: { select: { id: true, number: true, name: true } },
      author: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: 'desc' }, take: 5 },
      _count: { select: { comments: true, attachments: true, evidenceRequests: true } },
    },
  })

  if (!report) return apiError('RelatÃ³rio nÃ£o encontrado', 404)

  if (!canAccessArea(session, report.areaId)) {
    return apiError('Sem acesso a este relatÃ³rio', 403)
  }

  // Ocultar rascunhos de outros autores (exceto admin/director)
  if (
    report.status === 'draft' &&
    report.authorId !== session.user.id &&
    !['master', 'admin', 'director'].includes(session.user.role)
  ) {
    return apiError('RelatÃ³rio nÃ£o encontrado', 404)
  }

  return apiSuccess(report)
}

// PUT /api/reports/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('NÃ£o autenticado', 401)

  const report = await prisma.report.findUnique({ where: { id: params.id } })
  if (!report) return apiError('RelatÃ³rio nÃ£o encontrado', 404)

  // Somente o autor ou admin pode editar
  if (report.authorId !== session.user.id && !['master', 'admin'].includes(session.user.role)) {
    return apiError('Sem permissÃ£o para editar este relatÃ³rio', 403)
  }

  const body = await req.json()
  const { action, ...fields } = body

  // Salvar versÃ£o antes de atualizar
  if (action === 'publish' || action === 'update') {
    const lastVersion = await prisma.reportVersion.findFirst({
      where: { reportId: params.id },
      orderBy: { versionNumber: 'desc' },
    })
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1

    await prisma.reportVersion.create({
      data: {
        reportId: params.id,
        versionNumber: nextVersion,
        snapshot: JSON.stringify(report),
        createdBy: session.user.id,
      },
    })
  }

  const updateData: any = { ...fields }

  if (action === 'publish') {
    updateData.status = 'published'
    updateData.publishedAt = new Date()
    updateData.hasCritical = !!(fields.criticalPoints?.trim())
    updateData.hasDecisionNeeded = !!(fields.decisionsNeeded?.trim())
  }

  const updated = await prisma.report.update({
    where: { id: params.id },
    data: updateData,
    include: {
      area: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  })

  if (action === 'publish') {
    await notifyReportPublished(updated.id, updated.title, session.user.name ?? 'AlguÃ©m')
  }

  await audit({
    userId: session.user.id,
    action: action === 'publish' ? ACTIONS.REPORT_PUBLISHED : ACTIONS.REPORT_UPDATED,
    objectType: 'report',
    objectId: updated.id,
  })

  return apiSuccess(updated)
}

// DELETE /api/reports/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('NÃ£o autenticado', 401)

  if (!['master', 'admin', 'director'].includes(session.user.role)) {
    return apiError('Sem permissÃ£o', 403)
  }

  const report = await prisma.report.findUnique({ where: { id: params.id } })
  if (!report) return apiError('RelatÃ³rio nÃ£o encontrado', 404)

  await prisma.report.delete({ where: { id: params.id } })

  await audit({
    userId: session.user.id,
    action: 'report.deleted',
    objectType: 'report',
    objectId: params.id,
  })

  return apiSuccess({ deleted: true })
}

