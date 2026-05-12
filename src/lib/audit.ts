import { prisma } from './prisma'
import { headers } from 'next/headers'

interface AuditInput {
  userId: string
  action: string
  objectType?: string
  objectId?: string
  metadata?: Record<string, unknown>
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    const headersList = headers()
    const ip =
      headersList.get('x-forwarded-for') ??
      headersList.get('x-real-ip') ??
      'unknown'

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId,
        metadata: input.metadata ?? undefined,
        ipAddress: ip.split(',')[0].trim(), // pega o primeiro IP em caso de proxy
      },
    })
  } catch (err) {
    // Nunca deixar falha de auditoria quebrar a operação principal
    console.error('[AUDIT] Falha ao registrar:', err)
  }
}

// Ações pré-definidas para consistência
export const ACTIONS = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DEACTIVATED: 'user.deactivated',
  REPORT_CREATED: 'report.created',
  REPORT_UPDATED: 'report.updated',
  REPORT_PUBLISHED: 'report.published',
  REPORT_ARCHIVED: 'report.archived',
  DEMAND_CREATED: 'demand.created',
  DEMAND_UPDATED: 'demand.updated',
  DEMAND_COMPLETED: 'demand.completed',
  DEMAND_CANCELLED: 'demand.cancelled',
  COMMENT_CREATED: 'comment.created',
  EVIDENCE_REQUESTED: 'evidence_request.created',
  EVIDENCE_RESOLVED: 'evidence_request.resolved',
  ATTACHMENT_UPLOADED: 'attachment.uploaded',
  ATTACHMENT_DELETED: 'attachment.deleted',
  ATTACHMENT_DOWNLOADED: 'attachment.downloaded',
  CONTRACT_UPDATED: 'contract.updated',
  AGENDA_CREATED: 'agenda.created',
  AGENDA_UPDATED: 'agenda.updated',
} as const
