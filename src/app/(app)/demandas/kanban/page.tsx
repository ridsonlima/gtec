import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import { KanbanBoard } from '@/components/demands/KanbanBoard'
import { LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'

export default async function KanbanPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const areaIds = getUserAreaIds(session)

  const orClauses: any[] = areaIds
    ? [
        { areaId: { in: areaIds } },
        { requestingAreaId: { in: areaIds } },
        { responsibleId: session.user.id },
      ]
    : []

  const demands = await prisma.demand.findMany({
    where: {
      status: { notIn: ['cancelled'] },
      ...(areaIds ? { OR: orClauses } : {}),
    },
    orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
    take: 200,
    include: {
      area:        { select: { name: true } },
      responsible: { select: { name: true } },
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Kanban de Demandas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {demands.length} demanda{demands.length !== 1 ? 's' : ''} ativas
          </p>
        </div>

        <Link
          href="/demandas"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200
                     text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <List className="w-4 h-4" />
          Lista
        </Link>
      </div>

      <KanbanBoard initialDemands={demands} />
    </div>
  )
}
