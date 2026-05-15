import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Briefcase, ChevronRight, Plus, AlertTriangle, Clock } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  active:    'Ativo',
  at_risk:   'Em risco',
  delayed:   'Atrasado',
  suspended: 'Suspenso',
  completed: 'Concluído',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'text-green-700 bg-green-50 border-green-200',
  at_risk:   'text-red-700 bg-red-50 border-red-200',
  delayed:   'text-amber-700 bg-amber-50 border-amber-200',
  suspended: 'text-gray-600 bg-gray-100 border-gray-200',
  completed: 'text-blue-700 bg-blue-50 border-blue-200',
}

function expiryInfo(endDate: Date | null): {
  label: string
  cls: string
  urgent: boolean
} | null {
  if (!endDate) return null
  const days = Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  if (days < 0)
    return { label: `Vencido há ${Math.abs(days)}d`, cls: 'text-red-700 bg-red-50 border-red-200',   urgent: true }
  if (days <= 30)
    return { label: `Vence em ${days}d`,             cls: 'text-amber-700 bg-amber-50 border-amber-200', urgent: true }
  if (days <= 90)
    return { label: `Vence em ${days}d`,             cls: 'text-yellow-700 bg-yellow-50 border-yellow-200', urgent: false }
  return null
}

export default async function ContractsPage() {
  const session = await auth()
  if (!session) return null

  const today          = new Date()
  const in30           = new Date(today); in30.setDate(today.getDate() + 30)
  const in90           = new Date(today); in90.setDate(today.getDate() + 90)
  const allowedAreaIds = getUserAreaIds(session)

  const contracts = await prisma.contract.findMany({
    where: allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {},
    orderBy: [{ endDate: 'asc' }, { status: 'asc' }],
    include: {
      area: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      _count: { select: { reports: true, demands: true, attachments: true } },
    },
  })

  const expired      = contracts.filter((c) => c.endDate && c.endDate < today && c.status !== 'completed')
  const expiringSoon = contracts.filter((c) => c.endDate && c.endDate >= today && c.endDate <= in30 && c.status !== 'completed')
  const active       = contracts.filter((c) => c.status === 'active')

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-gray-500" />
            Contratos
          </h1>
          <p className="text-sm text-gray-500 mt-1">Visão consolidada dos contratos por área.</p>
        </div>
        {['master', 'admin', 'director'].includes(session.user.role) && (
          <Link
            href="/contratos/novo"
            className="inline-flex items-center gap-2 px-3 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Novo contrato
          </Link>
        )}
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={contracts.length} color="gray" />
        <StatCard label="Ativos" value={active.length} color="green" />
        <StatCard label="Vencendo (30d)" value={expiringSoon.length} color={expiringSoon.length > 0 ? 'amber' : 'gray'} />
        <StatCard label="Vencidos" value={expired.length} color={expired.length > 0 ? 'red' : 'gray'} />
      </div>

      {/* Alertas de vencimento */}
      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Atenção ao prazo de contratos</p>
          </div>
          <div className="space-y-1.5">
            {[...expired, ...expiringSoon].map((c) => {
              const exp = expiryInfo(c.endDate)
              return (
                <Link
                  key={c.id}
                  href={`/contratos/${c.id}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${exp?.cls}`}>
                    {exp?.label}
                  </span>
                  <span className="text-gray-700">{c.name}</span>
                  <span className="text-gray-400 text-xs">· {c.area.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista */}
      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          Nenhum contrato encontrado.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {contracts.map((contract) => {
            const exp = expiryInfo(contract.endDate)
            return (
              <Link
                key={contract.id}
                href={`/contratos/${contract.id}`}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group ${
                  exp?.urgent && contract.status !== 'completed' ? 'bg-red-50/20' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-gray-400">{contract.number}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[contract.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                      {STATUS_LABELS[contract.status] ?? contract.status}
                    </span>
                    {exp && contract.status !== 'completed' && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${exp.cls}`}>
                        <Clock className="w-3 h-3" />
                        {exp.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{contract.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {contract.area.name}
                    {contract.responsible ? ` · ${contract.responsible.name}` : ''}
                    {contract.endDate ? ` · até ${formatDate(contract.endDate)}` : ''}
                  </p>
                </div>
                <div className="hidden sm:flex gap-3 text-xs text-gray-400">
                  <span>{contract._count.reports} relatórios</span>
                  <span>{contract._count.demands} demandas</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'gray' | 'green' | 'amber' | 'red' }) {
  const map = {
    gray:  'bg-gray-50 border-gray-100 text-gray-500',
    green: 'bg-green-50 border-green-100 text-green-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    red:   'bg-red-50 border-red-100 text-red-700',
  }
  const numMap = {
    gray:  'text-gray-600',
    green: 'text-green-700',
    amber: 'text-amber-700',
    red:   'text-red-700',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${map[color]}`}>
      <p className={`text-2xl font-bold ${numMap[color]}`}>{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  )
}
