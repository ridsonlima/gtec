import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { deleteFile } from '@/lib/storage'
import { isDirector } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
  })
  if (!attachment) return apiError('Não encontrado', 404)

  const canDelete =
    attachment.uploadedById === session.user.id ||
    isDirector(session.user.role)

  if (!canDelete) return apiError('Sem permissão', 403)

  await deleteFile(attachment.storageKey)
  await prisma.attachment.delete({ where: { id: params.id } })

  await audit({
    userId: session.user.id,
    action: ACTIONS.ATTACHMENT_UPLOADED,
    objectType: attachment.objectType as any,
    objectId: attachment.objectId,
    metadata: { deleted: true, fileName: attachment.originalName },
  })

  return apiSuccess({ deleted: true })
}
