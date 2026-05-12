import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import {
  uploadFile,
  generateStorageKey,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/storage'
import { audit, ACTIONS } from '@/lib/audit'
import type { ObjectType } from '@/types/enums'

// POST /api/attachments — multipart/form-data
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const objectType = formData.get('objectType') as string
    const objectId = formData.get('objectId') as string
    const evidenceRequestId = formData.get('evidenceRequestId') as string | null

    if (!file) return apiError('Arquivo não enviado', 400)
    if (!objectType || !objectId) return apiError('objectType e objectId obrigatórios', 400)

    // Valida tipo
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(`Tipo de arquivo não permitido: ${file.type}`, 400)
    }

    // Valida tamanho
    if (file.size > MAX_FILE_SIZE) {
      return apiError('Arquivo muito grande. Limite: 50MB', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const storageKey = generateStorageKey(objectType, objectId, file.name)

    // Upload para Supabase Storage
    await uploadFile(buffer, storageKey, file.type)

    // Registra no banco
    const attachment = await prisma.attachment.create({
      data: {
        objectType: objectType as ObjectType,
        objectId,
        uploadedById: session.user.id,
        originalName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        evidenceRequestId: evidenceRequestId || null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })

    // Se vinculado a uma evidence request, marca como recebida
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
      metadata: { fileName: file.name, size: file.size },
    })

    return apiSuccess(attachment, 201)
  } catch (e) {
    console.error('[POST /api/attachments]', e)
    return apiError('Erro ao fazer upload do arquivo', 500)
  }
}
