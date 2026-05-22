import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { ALLOWED_MIME_TYPES } from '@/lib/storage'
import { audit, ACTIONS } from '@/lib/audit'
import type { ObjectType } from '@/types/enums'

/**
 * POST /api/attachments
 *
 * Chamado pelo cliente APÓS o upload direto para o Vercel Blob
 * (via @vercel/blob/client `upload()`).
 *
 * Recebe: { blobUrl, originalName, mimeType, sizeBytes, objectType, objectId, evidenceRequestId? }
 * Retorna: o objeto Attachment criado no banco.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const body = await req.json()
  const { blobUrl, originalName, mimeType, sizeBytes, objectType, objectId, evidenceRequestId } = body

  if (!blobUrl || !objectType || !objectId || !originalName) {
    return apiError('Campos obrigatórios ausentes', 400)
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return apiError(`Tipo não permitido: ${mimeType}`, 400)
  }

  const attachment = await prisma.attachment.create({
    data: {
      objectType: objectType as ObjectType,
      objectId,
      uploadedById: session.user.id,
      originalName,
      storageKey: blobUrl,
      mimeType,
      sizeBytes: Number(sizeBytes),
      evidenceRequestId: evidenceRequestId || null,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  if (evidenceRequestId) {
    await prisma.evidenceRequest.update({
      where: { id: evidenceRequestId },
      data: { status: 'received', resolvedAt: new Date() },
    })
  }

  await audit({
    userId: session.user.id,
    action: ACTIONS.ATTACHMENT_UPLOADED,
    objectType,
    objectId,
    metadata: { fileName: originalName, size: sizeBytes },
  })

  return apiSuccess(attachment, 201)
}
