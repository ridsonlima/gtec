import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isDirector } from '@/lib/permissions'
import { notifyEvidenceReceived } from '@/lib/notifications'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const ev = await prisma.evidenceRequest.findUnique({ where: { id: params.id } })
  if (!ev) return apiError('Evidência não encontrada', 404)

  const isRequester = ev.requestedById === session.user.id
  if (!isDirector(session.user.role) && !isRequester) {
    return apiError('Sem permissão', 403)
  }

  const body          = await req.json()
  const status        = body.status as string
  const responseNotes = typeof body.responseNotes === 'string' ? body.responseNotes : null

  if (!['received', 'rejected'].includes(status)) {
    return apiError('Status inválido', 400)
  }

  const updated = await prisma.evidenceRequest.update({
    where: { id: params.id },
    data: { status, responseNotes, resolvedAt: new Date() },
  })

  if (status === 'received') {
    await notifyEvidenceReceived(
      ev.objectType,
      ev.objectId,
      ev.requestedById,
      session.user.name ?? 'Alguém',
    )
  }

  return apiSuccess(updated)
}
