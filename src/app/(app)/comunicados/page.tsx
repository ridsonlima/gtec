import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isManagerOrAbove } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ComunicadosClient } from './ComunicadosClient'

export default async function ComunicadosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const canCreate = isManagerOrAbove(session.user.role)

  const areas = canCreate
    ? await prisma.area.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      })
    : []

  return <ComunicadosClient canCreate={canCreate} areas={areas} currentUserId={session.user.id} />
}
