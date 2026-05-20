import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { Layers, ChevronRight } from 'lucide-react'

const AREA_SLUGS: Record<string, string> = {
  PLAN: 'sala-tecnica',
  PLAN_PLANEJ: 'planejamento',
  PLAN_ORC: 'orcamento',
  OBRAS_PROP: 'obras-proprias',
  OBRAS_TERC: 'obras-terceirizadas',
  SESMT: 'sesmt',
  EQUIP: 'equipamentos',
}

export default async function AreasPage() {
  const session = await auth()
  if (!session) return null

  const allowedAreaIds = getUserAreaIds(session)
  const areas = await prisma.area.findMany({
    where: allowedAreaIds ? { id: { in: allowedAreaIds }, isActive: true } : { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { reports: true, demands: true, contracts: true } },
        },
      },
      _count: { select: { reports: true, demands: true, contracts: true } },
    },
  })

  // Exibir apenas áreas raiz (sem pai) para evitar duplicação
  const rootAreas = areas.filter((a) => !a.parentId)

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-gray-500" />
          Áreas
        </h1>
        <p className="text-sm text-gray-500 mt-1">Acompanhe reports, demandas e contratos por área.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rootAreas.map((area) => {
          const hasChildren = area.children.length > 0
          if (hasChildren) {
            return (
              <div key={area.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{area.name}</p>
                </div>
                {area.description && <p className="text-xs text-gray-500">{area.description}</p>}
                <div className="space-y-1.5 mt-2">
                  {area.children.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/areas/${AREA_SLUGS[sub.code] ?? sub.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sub.name}</p>
                        <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{sub._count.reports} reports</span>
                          <span>{sub._count.demands} demandas</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                    </Link>
                  ))}
                </div>
              </div>
            )
          }
          return (
            <Link
              key={area.id}
              href={`/areas/${AREA_SLUGS[area.code] ?? area.id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{area.name}</p>
                  {area.description && <p className="text-xs text-gray-500 mt-1">{area.description}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
              </div>
              <div className="flex gap-3 mt-3 text-xs text-gray-500">
                <span>{area._count.reports} reports</span>
                <span>{area._count.demands} demandas</span>
                <span>{area._count.contracts} contratos</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
