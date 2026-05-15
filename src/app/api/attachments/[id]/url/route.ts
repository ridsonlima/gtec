import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/types/api'
import { getSignedUrl } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
  })
  if (!attachment) return apiError('Não encontrado', 404)

  const url = await getSignedUrl(attachment.storageKey)
  return NextResponse.redirect(url)
}
