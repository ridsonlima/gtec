import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import { RotinasClient } from './RotinasClient'

export const dynamic = 'force-dynamic'

export default async function RotinasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const canManage = ['master', 'admin', 'director', 'manager', 'supervisor'].includes(session.user.role)
  const verTudo = isDirector(session.user.role)

  const areas = verTudo
    ? await prisma.area.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
    : await prisma.area.findMany({
        where: { id: { in: session.user.areaScopes.map((s) => s.areaId) }, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })

  return <RotinasClient areas={areas} canManage={canManage} />
}
