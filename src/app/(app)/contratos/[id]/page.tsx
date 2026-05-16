import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ContractDeleteButton } from '@/components/contracts/ContractDeleteButton'
import { PartnerSection } from '@/components/contracts/PartnerSection'
import { ContractorsSection } from '@/components/contracts/ContractorsSection'
import { ChevronLeft, Briefcase, Calendar, DollarSign, FileText, AlertTriangle, User } from 'lucide-react'

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

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return null

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      area: true,
      responsible: { select: { id: true, name: true } },
      partner: true,
      contractors: { orderBy: { createdAt: 'asc' } },
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { author: { select: { id: true, name: true } } },
      },
      demands: {
        where: { status: { notIn: ['completed', 'cancelled'] } },
        orderBy: [{ isOverdue: 'desc' }, { priority: 'asc' }],
        take: 8,
        include: { responsible: { select: { id: true, name: true } } },
      },
      _count: { select: { reports: true, demands: true, attachments: true } },
    },
  })

  if (!contract) notFound()
  if (!canAccessArea(session, contract.areaId)) notFound()

  const canEdit = ['master', 'admin', 'director'].includes(session.user.role)
  const formatCurrency = (val: number | null) => val == null ? '-' : val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const daysRemaining = contract.endDate ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="max-w-5xl space-y-5">
      <Link href={`/areas/${contract.areaId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" />
        {contract.area.name}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[contract.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
              {STATUS_LABELS[contract.status] ?? contract.status}
            </span>
            <span className="text-xs font-mono text-gray-400">{contract.number}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{contract.name}</h1>
          {contract.description && <p className="text-sm text-gray-500 mt-1 max-w-2xl">{contract.description}</p>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href={`/contratos/${contract.id}/editar`} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Editar</Link>
            {session.user.role === 'master' && <ContractDeleteButton contractId={contract.id} />}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {contract.responsible && <Info icon={<User className="w-3.5 h-3.5" />} label="Responsavel" value={contract.responsible.name} />}
          {contract.client && <Info icon={<Briefcase className="w-3.5 h-3.5" />} label="Empresa" value={contract.client} />}
          {contract.estimatedValue != null && <Info icon={<DollarSign className="w-3.5 h-3.5" />} label="Valor" value={formatCurrency(contract.estimatedValue)} />}
          {contract.startDate && <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Inicio" value={formatDate(contract.startDate)} />}
          {contract.endDate && <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Termino" value={`${formatDate(contract.endDate)}${daysRemaining != null ? (daysRemaining > 0 ? ` (${daysRemaining}d restantes)` : ' (vencido)') : ''}`} />}
        </div>

        {(contract.physicalProgress != null || contract.financialProgress != null) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
            {contract.physicalProgress != null && <Progress label="Avanco fisico" value={contract.physicalProgress} color="bg-blue-500" />}
            {contract.financialProgress != null && <Progress label="Avanco financeiro" value={contract.financialProgress} color="bg-green-500" />}
          </div>
        )}

        {contract.riskNotes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Observacoes</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{contract.riskNotes}</p>
          </div>
        )}
      </div>

      {contract.executionModality === 'partner' && (
        <PartnerSection contractId={contract.id} partner={contract.partner} canEdit={canEdit} />
      )}
      {contract.executionModality === 'contractor' && (
        <ContractorsSection contractId={contract.id} contractors={contract.contractors} canEdit={canEdit} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5"><FileText className="w-4 h-4" />Reports ({contract._count.reports})</h2>
            <Link href={`/reports/novo?contractId=${contract.id}&areaId=${contract.areaId}`} className="text-xs text-blue-600 hover:underline">+ Novo report</Link>
          </div>

          {contract.reports.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">Nenhum report vinculado</div>
          ) : (
            <div className="space-y-2">
              {contract.reports.map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-sm transition-shadow">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5"><StatusBadge status={r.status} /></div>
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400">{r.author.name} - {timeAgo(new Date(r.createdAt))}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2"><AlertTriangle className="w-4 h-4" />Demandas Abertas ({contract.demands.length})</h2>
          {contract.demands.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Nenhuma demanda aberta</div>
          ) : (
            <div className="space-y-2">
              {contract.demands.map((d) => (
                <Link key={d.id} href={`/demandas/${d.id}`} className="block bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:shadow-sm transition-shadow">
                  {d.isOverdue && <span className="text-xs font-bold text-red-600">VENCIDA - </span>}
                  <p className="text-sm text-gray-800 font-medium line-clamp-2">{d.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.responsible?.name}{d.dueDate ? ` - ${formatDate(d.dueDate)}` : ''}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">{icon} {label}</p><p className="text-sm font-medium text-gray-800">{value}</p></div>
}

function Progress({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><p className="text-xs text-gray-400 mb-0.5">{label}</p><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} /></div><span className="text-sm font-medium text-gray-800">{value}%</span></div></div>
}
