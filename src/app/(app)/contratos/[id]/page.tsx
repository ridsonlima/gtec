import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ContractDeleteButton } from '@/components/contracts/ContractDeleteButton'
import { ContratoProjetos } from '@/components/contracts/ContratoProjetos'
import { ContractPartnersSection } from '@/components/contracts/ContractPartnersSection'
import { ContractorsSection } from '@/components/contracts/ContractorsSection'
import { MedicoesSection } from '@/components/contracts/MedicoesSection'
import { FechamentoMensalSection } from '@/components/contracts/FechamentoMensalSection'
import { ResumoExecutivo } from '@/components/contracts/ResumoExecutivo'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'
import { AprovacoesContrato } from '@/components/approvo/AprovacoesContrato'
import { getAusenciasMap } from '@/lib/ausencias'
import { SubstituicaoAlert } from '@/components/shared/SubstituicaoBadge'
import { ChevronLeft, Briefcase, Calendar, DollarSign, FileText, AlertTriangle, User, RefreshCw, TrendingUp } from 'lucide-react'

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
      contractPartners: {
        include: {
          empresaParceira: true,
          instrumentos: { orderBy: { createdAt: 'asc' } },
          itensLocacao: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      fechamentosMensais: {
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        include: {
          createdBy: { select: { id: true, name: true } },
          transacoes: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: [{ hipotese: 'asc' }, { createdAt: 'asc' }],
          },
          usosItens: { include: { itemLocacao: true } },
        },
      },
      contractors: { orderBy: { createdAt: 'asc' } },
      medicoes: {
        orderBy: [{ competenciaAno: 'asc' }, { competenciaMes: 'asc' }],
        include: { adiantamentos: { orderBy: { dataAdiantamento: 'asc' } } },
      },
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
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      _count: { select: { reports: true, demands: true, attachments: true } },
    },
  })

  if (!contract) notFound()
  if (!canAccessArea(session, contract.areaId)) notFound()

  // ── Sinais para o Resumo Executivo (página viva) ──────────────────────────
  const [demandasAbertasTotal, demandasVencidas, evidenciasPendentes] = await Promise.all([
    prisma.demand.count({ where: { contractId: contract.id, status: { notIn: ['completed', 'cancelled'] } } }),
    prisma.demand.count({ where: { contractId: contract.id, isOverdue: true, status: { notIn: ['completed', 'cancelled'] } } }),
    prisma.evidenceRequest.count({ where: { objectType: 'contract', objectId: contract.id, status: 'pending' } }),
  ])

  const canEdit = ['master', 'admin', 'director'].includes(session.user.role)
  const ausenciasMap = await getAusenciasMap([contract.responsibleId])
  const ausenciaResp = contract.responsibleId ? ausenciasMap.get(contract.responsibleId) : undefined
  const formatCurrency = (val: number | null) => val == null ? '-' : val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const daysRemaining = contract.endDate ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000) : null

  // Cálculo do próximo aniversário de reajuste
  const nextReadjustmentDate = contract.proposalDate
    ? (() => {
        const base = new Date(contract.proposalDate)
        const next = new Date(base)
        next.setFullYear(base.getFullYear() + contract.readjustmentCount + 1)
        return next
      })()
    : null
  const daysToReadjustment = nextReadjustmentDate
    ? Math.ceil((nextReadjustmentDate.getTime() - Date.now()) / 86400000)
    : null
  const readjustmentDue = daysToReadjustment != null && daysToReadjustment <= 30

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

      {/* Alerta de substituição temporária do responsável */}
      {ausenciaResp && contract.responsible && (
        <SubstituicaoAlert nome={contract.responsible.name} info={ausenciaResp} />
      )}

      {/* Resumo Executivo — página viva */}
      <ResumoExecutivo
        contractId={contract.id}
        status={contract.status}
        demandasAbertas={demandasAbertasTotal}
        demandasVencidas={demandasVencidas}
        evidenciasPendentes={evidenciasPendentes}
        diasParaVencer={daysRemaining}
        reajusteVencendo={readjustmentDue}
        diasReajuste={daysToReadjustment}
        temRiscos={!!contract.riskNotes}
      />

      {/* Aprovações pendentes do contrato (Approvo) — fila do próprio usuário */}
      <AprovacoesContrato userId={session.user.id} referencias={[contract.number, contract.name]} />

      {/* Projetos da obra (contrato guarda-chuva → vários projetos) */}
      <ContratoProjetos contractId={contract.id} defaultResponsavelId={contract.responsibleId ?? undefined} canManage={canEdit} />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {contract.responsible && <Info icon={<User className="w-3.5 h-3.5" />} label="Responsavel" value={contract.responsible.name} />}
          {contract.client && <Info icon={<Briefcase className="w-3.5 h-3.5" />} label="Empresa" value={contract.client} />}
          {contract.estimatedValue != null && <Info icon={<DollarSign className="w-3.5 h-3.5" />} label="Valor" value={formatCurrency(contract.estimatedValue)} />}
          {contract.startDate && <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Inicio" value={formatDate(contract.startDate)} />}
          {contract.endDate && <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Termino" value={`${formatDate(contract.endDate)}${daysRemaining != null ? (daysRemaining > 0 ? ` (${daysRemaining}d restantes)` : ' (vencido)') : ''}`} />}
          {contract.proposalDate && <Info icon={<FileText className="w-3.5 h-3.5" />} label="Data da proposta" value={formatDate(contract.proposalDate)} />}
          {contract.readjustmentIndex && <Info icon={<TrendingUp className="w-3.5 h-3.5" />} label="Índice de reajuste" value={contract.readjustmentIndex} />}
          <Info
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Reajustes aplicados"
            value={`${contract.readjustmentCount} reajuste${contract.readjustmentCount !== 1 ? 's' : ''}`}
          />
          {nextReadjustmentDate && (
            <InfoHighlight
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Próximo reajuste"
              value={formatDate(nextReadjustmentDate)}
              note={daysToReadjustment != null
                ? daysToReadjustment > 0
                  ? `em ${daysToReadjustment}d`
                  : 'vencido'
                : undefined}
              alert={readjustmentDue}
            />
          )}
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
        <ContractPartnersSection
          contractId={contract.id}
          partners={contract.contractPartners as any}
          canEdit={canEdit}
        />
      )}
      {contract.executionModality === 'contractor' && (
        <ContractorsSection contractId={contract.id} contractors={contract.contractors} canEdit={canEdit} />
      )}
      {contract.executionModality === 'partner' && (
        <MedicoesSection
          contractId={contract.id}
          medicoes={contract.medicoes as any}
          partners={contract.contractPartners.map((cp) => ({ id: cp.id, percentageTotal: cp.percentageTotal, empresaParceira: { name: cp.empresaParceira.name } }))}
          canEdit={canEdit}
        />
      )}

      {contract.executionModality === 'partner' && (() => {
        const empresaA = contract.contractPartners.find((cp) => cp.empresaParceira.tipo === 'empresa_a')
        const empresaB = contract.contractPartners.find((cp) => cp.empresaParceira.tipo === 'empresa_b')
        const itensLocacao = (empresaB as any)?.itensLocacao ?? []
        return (
          <FechamentoMensalSection
            contractId={contract.id}
            fechamentos={contract.fechamentosMensais as any}
            percentualAdm={empresaA?.percentualAdministracao ?? null}
            itensLocacao={itensLocacao}
            canEdit={canEdit}
          />
        )
      })()}

      {/* Evidências / Anexos do contrato */}
      <AttachmentsPanel
        initialAttachments={contract.attachments.map((a) => ({ ...a, createdAt: new Date(a.createdAt) }))}
        objectType="contract"
        objectId={contract.id}
        canUpload={canEdit}
        currentUserId={session.user.id}
        canDeleteAll={['master', 'admin', 'director'].includes(session.user.role)}
      />

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

function InfoHighlight({ icon, label, value, note, alert }: {
  icon: React.ReactNode; label: string; value: string; note?: string; alert?: boolean
}) {
  return (
    <div className={alert ? 'rounded-lg px-2 py-1.5 -mx-2 bg-amber-50 border border-amber-200' : ''}>
      <p className={`text-xs flex items-center gap-1 mb-0.5 ${alert ? 'text-amber-600' : 'text-gray-400'}`}>{icon} {label}</p>
      <p className={`text-sm font-medium ${alert ? 'text-amber-700' : 'text-gray-800'}`}>
        {value}
        {note && <span className={`ml-1.5 text-xs font-normal ${alert ? 'text-amber-500' : 'text-gray-400'}`}>({note})</span>}
      </p>
    </div>
  )
}

function Progress({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><p className="text-xs text-gray-400 mb-0.5">{label}</p><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} /></div><span className="text-sm font-medium text-gray-800">{value}%</span></div></div>
}
