import { prisma } from './prisma'

type NotificationInput = {
  userId: string
  type: string
  title: string
  body?: string
  objectType?: string
  objectId?: string
}

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({ data: input })
}

export async function notifyDemandAssigned(demandId: string, demandTitle: string, responsibleId: string, authorName?: string) {
  await createNotification({
    userId: responsibleId,
    type: 'demand_assigned',
    title: 'Nova demanda atribuída a você',
    body: authorName ? `${authorName}: ${demandTitle}` : demandTitle,
    objectType: 'demand',
    objectId: demandId,
  })
}

export async function notifyReportPublished(reportId: string, reportTitle: string, authorName: string) {
  const directors = await prisma.user.findMany({ where: { role: { in: ['master', 'director', 'admin'] }, isActive: true } })
  await prisma.notification.createMany({
    data: directors.map((d) => ({
      userId: d.id,
      type: 'report_published',
      title: `Novo report publicado por ${authorName}`,
      body: reportTitle,
      objectType: 'report',
      objectId: reportId,
    })),
  })
}

export async function notifyComment(objectType: string, objectId: string, authorName: string, targetUserIds: string[]) {
  if (!targetUserIds.length) return
  await prisma.notification.createMany({
    data: targetUserIds.map((userId) => ({
      userId,
      type: 'comment',
      title: `Novo comentário de ${authorName}`,
      objectType,
      objectId,
    })),
  })
}

export async function notifyEvidenceRequested(objectType: string, objectId: string, responsibleId: string, authorOrDescription: string, description?: string) {
  await createNotification({
    userId: responsibleId,
    type: 'evidence_requested',
    title: 'Evidência solicitada',
    body: description ?? authorOrDescription,
    objectType,
    objectId,
  })
}

export async function notifyEvidenceReceived(objectType: string, objectId: string, requesterId: string, responsibleName: string) {
  await createNotification({
    userId: requesterId,
    type: 'evidence_received',
    title: 'Evidência recebida',
    body: `${responsibleName} enviou a evidência solicitada`,
    objectType,
    objectId,
  })
}

export async function notifyFollowUp(objectType: string, objectId: string, responsibleId: string, authorName: string, content: string) {
  if (!responsibleId) return
  await createNotification({
    userId: responsibleId,
    type: 'follow_up',
    title: 'Nova cobrança de ' + authorName,
    body: content,
    objectType,
    objectId,
  })
}

export async function notifyMention(objectType: string, objectId: string, mentionedUserId: string, authorName: string, content: string) {
  await createNotification({
    userId: mentionedUserId,
    type: 'mention',
    title: `${authorName} mencionou você`,
    body: content.length > 120 ? content.slice(0, 120) + '...' : content,
    objectType,
    objectId,
  })
}

export async function notifyCollaboratorAdded(demandId: string, demandTitle: string, userId: string, addedByName: string) {
  await createNotification({
    userId,
    type: 'collaborator_added',
    title: 'Você foi adicionado como colaborador',
    body: `${addedByName} te adicionou na demanda: ${demandTitle}`,
    objectType: 'demand',
    objectId: demandId,
  })
}
