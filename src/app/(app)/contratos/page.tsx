import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Briefcase, ChevronRight } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  at_risk: 'Em risco',
  delayed: 'Atrasado',
  suspended: 'Suspenso',
  completed: 'Concluido',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50 border-green-200',
  at_risk: 'text-red-700 bg-red-50 border-red-200',
  delayed: 'text-amber-700 bg-amber-50 border-amber-200',
  suspended: 'text-gray-600 bg-gray-100 border-gray-200',
  completed: 'text-blue-700 bg-blue-50 border-blue-200',
}

export default async function ContractsPage() {
  const session = await auth()
  if (!session) return null

  const allowedAreaIds = getUserAreaIds(session)
  const contracts = await prisma.contract.findMany({
    where: allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {},
    orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
    include: {
      area: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      _count: { select: { reports: true, demands: true, attachments: true } },
    },
  })

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-gray-500" />
          Contratos
        </h1>
        <p className="text-sm text-gray-500 mt-1">Visao consolidada dos contratos por area.</p>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          Nenhum contrato encontrado.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {contracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/contratos/${contract.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-gray-400">{contract.number}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[contract.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                    {STATUS_LABELS[contract.status] ?? contract.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{contract.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {contract.area.name}
                  {contract.responsible ? ` - ${contract.responsible.name}` : ''}
                  {contract.endDate ? ` - ate ${formatDate(contract.endDate)}` : ''}
                </p>
              </div>
              <div className="hidden sm:flex gap-3 text-xs text-gray-400">
                <span>{contract._count.reports} reports</span>
                <span>{contract._count.demands} demandas</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
