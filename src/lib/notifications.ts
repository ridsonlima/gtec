import { prisma } from './prisma'
import type { NotificationType, ObjectType } from '@/types/enums'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  objectType?: ObjectType
  objectId?: string
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({ data: input })
}

export async function createNotificationBatch(
  inputs: CreateNotificationInput[]
) {
  if (inputs.length === 0) return
  return prisma.notification.createMany({ data: inputs })
}

// â”€â”€â”€ NOTIFICAÃ‡Ã•ES ESPECÃFICAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function notifyReportPublished(
  reportId: string,
  reportTitle: string,
  authorName: string
) {
  const directors = await prisma.user.findMany({
    where: { role: { in: ['master', 'director', 'admin'] }, isActive: true },
    select: { id: true },
  })

  await createNotificationBatch(
    directors.map((d) => ({
      userId: d.id,
      type: 'report_published' as NotificationType,
      title: 'Novo report publicado',
      body: `${authorName} publicou: ${reportTitle}`,
      link: `/reports/${reportId}`,
      objectType: 'report' as ObjectType,
      objectId: reportId,
    }))
  )
}

export async function notifyDemandAssigned(
  demandId: string,
  demandTitle: string,
  responsibleId: string,
  assignedByName: string
) {
  await createNotification({
    userId: responsibleId,
    type: 'demand_assigned',
    title: 'Nova demanda atribuÃ­da a vocÃª',
    body: `${assignedByName} atribuiu: ${demandTitle}`,
    link: `/demandas/${demandId}`,
    objectType: 'demand',
    objectId: demandId,
  })
}

export async function notifyComment(
  objectType: ObjectType,
  objectId: string,
  commentContent: string,
  authorName: string,
  notifyUserIds: string[]
) {
  const preview =
    commentContent.length > 80
      ? commentContent.slice(0, 80) + '...'
      : commentContent

  const linkMap: Partial<Record<ObjectType, string>> = {
    report: `/reports/${objectId}`,
    demand: `/demandas/${objectId}`,
  }

  await createNotificationBatch(
    notifyUserIds.map((userId) => ({
      userId,
      type: 'comment' as NotificationType,
      title: `Novo comentÃ¡rio de ${authorName}`,
      body: preview,
      link: linkMap[objectType],
      objectType,
      objectId,
    }))
  )
}

export async function notifyFollowUp(
  objectType: ObjectType,
  objectId: string,
  targetUserId: string,
  fromName: string,
  content: string
) {
  const linkMap: Partial<Record<ObjectType, string>> = {
    report: `/reports/${objectId}`,
    demand: `/demandas/${objectId}`,
  }

  await createNotification({
    userId: targetUserId,
    type: 'follow_up',
    title: `CobranÃ§a de ${fromName}`,
    body: content.slice(0, 100),
    link: linkMap[objectType],
    objectType,
    objectId,
  })
}

export async function notifyEvidenceRequested(
  objectType: ObjectType,
  objectId: string,
  responsibleId: string,
  requestedByName: string,
  description: string
) {
  const linkMap: Partial<Record<ObjectType, string>> = {
    report: `/reports/${objectId}`,
    demand: `/demandas/${objectId}`,
  }

  await createNotification({
    userId: responsibleId,
    type: 'evidence_requested',
    title: 'EvidÃªncia solicitada',
    body: `${requestedByName} solicitou: ${description.slice(0, 80)}`,
    link: linkMap[objectType],
    objectType,
    objectId,
  })
}

export async function notifyEvidenceReceived(
  objectType: ObjectType,
  objectId: string,
  requestedById: string,
  responsibleName: string
) {
  const linkMap: Partial<Record<ObjectType, string>> = {
    report: `/reports/${objectId}`,
    demand: `/demandas/${objectId}`,
  }

  await createNotification({
    userId: requestedById,
    type: 'evidence_received',
    title: 'EvidÃªncia recebida',
    body: `${responsibleName} enviou a evidÃªncia solicitada`,
    link: linkMap[objectType],
    objectType,
    objectId,
  })
}

