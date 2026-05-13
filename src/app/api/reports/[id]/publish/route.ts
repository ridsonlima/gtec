import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canPublishReport } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'
import { notifyReportPublished } from '@/lib/notifications'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    include: {
      area: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  })

  if (!report) return apiError('Report não encontrado', 404)

  // Usar canPublishReport: admin/master sempre pode; manager só o próprio
  if (!canPublishReport(session, report.authorId)) {
    return apiError('Você não tem permissão para publicar este report.', 403)
  }

  if (!canAccessArea(session, report.areaId, true) && !['master', 'admin'].includes(session.user.role)) {
    return apiError('Você não tem permissão de escrita nesta área.', 403)
  }

  if (!report.title?.trim()) {
    return apiError('Informe o título antes de publicar.', 422)
  }

  if (report.status === 'published') {
    return apiError('Este report já está publicado.', 422)
  }

  const lastVersion = await prisma.reportVersion.findFirst({
    where: { reportId: params.id },
    orderBy: { versionNumber: 'desc' },
  })

  await prisma.reportVersion.create({
    data: {
      reportId: params.id,
      versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
      snapshot: JSON.stringify(report),
      createdBy: session.user.id,
    },
  })

  const updated = await prisma.report.update({
    where: { id: params.id },
    data: {
      status: 'published',
      publishedAt: new Date(),
      hasCritical: !!report.criticalPoints?.trim(),
      hasDecisionNeeded: !!report.decisionsNeeded?.trim(),
    },
    include: {
      area: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  })

  await notifyReportPublished(updated.id, updated.title, session.user.name ?? 'Alguém').catch(console.error)

  await audit({
    userId: session.user.id,
    action: ACTIONS.REPORT_PUBLISHED,
    objectType: 'report',
    objectId: updated.id,
  })

  return apiSuccess(updated)
}
