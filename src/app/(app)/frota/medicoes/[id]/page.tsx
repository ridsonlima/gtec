import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { MedicaoAcoesBtn } from '@/components/frota/MedicaoAcoesBtn'
import {
  Receipt, ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  XCircle, CreditCard, FileText, Package, Calendar,
  ClipboardCheck, UserCheck,
} from 'lucide-react'
import { MedicaoItemRow } from '@/components/frota/MedicaoItemRow'
import { AdicionarItemMedicao } from '@/components/frota/AdicionarItemMedicao'

const STATUS_META: Record<string, { label: string; cls: string; icon: any; desc: string }> = {
  rascunho:          { label: 'Rascunho',               cls: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock,          desc: 'Preenchendo itens. Envie ao supervisor para conferência.' },
  aguard_supervisor: { label: 'Aguard. Supervisor',      cls: 'bg-amber-50 text-amber-700 border-amber-200',    icon: ClipboardCheck,  desc: 'Aguardando conferência obrigatória do supervisor de obra.' },
  enviada:           { label: 'Aguard. Aprovação',       cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: AlertTriangle,   desc: 'Supervisor conferiu. Aguardando aprovação gerencial.' },
  aprovada:          { label: 'Aprovada',                cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: CheckCircle2,    desc: 'Aprovada. Gere a guia de cobrança.' },
  guia_gerada:       { label: 'Guia gerada',             cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: FileText,        desc: 'Guia emitida. Registre o pagamento ao receber.' },
  paga:              { label: 'Paga',                    cls: 'bg-green-50 text-green-700 border-green-200',    icon: CreditCard,      desc: 'Pagamento registrado. Medição encerrada.' },
  rejeitada:         { label: 'Rejeitada',               cls: 'bg-red-50 text-red-700 border-red-200',          icon: XCircle,         desc: 'Rejeitada pela gerência. Corrija e reenvie.' },
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function FrotaMedicaoDetalhePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const medicao = await prisma.medicaoLocacao.findUnique({
    where: { id: params.id },
    include: {
      itens: {
        include: {
          ativo:  { select: { id: true, tag: true, descricao: true, categoria: true, tipo: true } },
          projeto: { select: { id: true, name: true } },
        },
        orderBy: { ativo: { tag: 'asc' } } as any,
      },
      contrato:  { select: { id: true, number: true, name: true, responsible: { select: { id: true, name: true } } } },
      aprovador: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!medicao) redirect('/frota/medicoes')

  const meta = STATUS_META[medicao.status] ?? STATUS_META.rascunho
  const StatusIcon = meta.icon
  const mesLabel = MESES[(medicao.competenciaMes - 1)] ?? ''

  const totalItems = medicao.itens.reduce((a, i) => a + i.totalItem, 0)
  const canEditItens = ['master', 'admin', 'manager'].includes(session.user.role) &&
    ['rascunho', 'rejeitada'].includes(medicao.status)

  // Timeline de etapas
  const timeline = [
    {
      label: 'Criado',
      sublabel: `por ${medicao.createdBy.name}`,
      done: true,
      date: medicao.createdAt,
      icon: Clock,
    },
    {
      label: 'Conferência do Supervisor',
      sublabel: medicao.supervisor ? `por ${medicao.supervisor.name}` : 'Aguardando supervisor de obra',
      done: !!medicao.supervisorAprovadoEm,
      date: medicao.supervisorAprovadoEm,
      icon: ClipboardCheck,
      nota: medicao.supervisorNota,
    },
    {
      label: 'Aprovação Gerencial',
      sublabel: medicao.aprovador ? `por ${medicao.aprovador.name}` : 'Aguardando aprovação',
      done: ['aprovada','guia_gerada','paga'].includes(medicao.status),
      date: medicao.dataAprovacao,
      icon: UserCheck,
    },
    {
      label: 'Guia de Cobrança',
      sublabel: 'Emissão da guia para faturamento',
      done: ['guia_gerada','paga'].includes(medicao.status),
      icon: FileText,
    },
    {
      label: 'Pagamento',
      sublabel: 'Recebimento confirmado',
      done: medicao.status === 'paga',
      date: medicao.dataPagamento,
      icon: CreditCard,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link href="/frota/medicoes" className="mt-1 p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Medição — {mesLabel} {medicao.competenciaAno}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                <StatusIcon className="w-3 h-3" />
                {meta.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{medicao.contrato.number} — {medicao.contrato.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
          </div>
        </div>

        <MedicaoAcoesBtn
          medicaoId={medicao.id}
          status={medicao.status as any}
          role={session.user.role}
          observacoes={medicao.observacoes}
        />
      </div>

      {/* Alerta de devolução / rejeição */}
      {medicao.rejeicaoMotivo && (
        <div className={`border rounded-xl p-4 flex gap-3 ${medicao.status === 'rascunho' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <XCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${medicao.status === 'rascunho' ? 'text-amber-500' : 'text-red-500'}`} />
          <div>
            <p className={`text-sm font-medium ${medicao.status === 'rascunho' ? 'text-amber-800' : 'text-red-800'}`}>
              {medicao.status === 'rascunho' ? 'Devolvida para correção' : 'Medição rejeitada'}
            </p>
            <p className={`text-sm mt-0.5 ${medicao.status === 'rascunho' ? 'text-amber-700' : 'text-red-700'}`}>
              {medicao.rejeicaoMotivo}
            </p>
          </div>
        </div>
      )}

      {/* Banner: aguardando supervisor */}
      {medicao.status === 'aguard_supervisor' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <ClipboardCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Ação necessária — Supervisor de obra</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Revise os itens abaixo, confirme os dias ativos e valores de cada ativo. Ao confirmar, preencha obrigatoriamente a nota de conferência.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Itens — coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Itens da medição
              </h2>
              <span className="text-xs text-gray-400">{medicao.itens.length} ativo{medicao.itens.length !== 1 ? 's' : ''}</span>
            </div>

            {medicao.itens.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">Nenhum item nesta medição</p>
                <p className="text-xs text-gray-400 mt-1">Adicione ativos alocados antes de enviar</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {medicao.itens.map((item) => (
                  <MedicaoItemRow
                    key={item.id}
                    item={item}
                    medicaoId={medicao.id}
                    canEdit={canEditItens}
                  />
                ))}
              </div>
            )}

            {/* Adicionar item (apenas rascunho/rejeitada) */}
            {canEditItens && (
              <div className="px-5 py-4 border-t border-gray-100">
                <AdicionarItemMedicao medicaoId={medicao.id} contratoId={medicao.contratoId} />
              </div>
            )}

            {/* Totais */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total da medição</span>
                <span className="text-2xl font-bold text-gray-900">
                  {medicao.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              {Math.abs(totalItems - medicao.totalGeral) > 0.01 && (
                <p className="text-xs text-amber-600 mt-1">⚠ Soma dos itens ({totalItems.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) difere do total registrado</p>
              )}
            </div>
          </div>

          {/* Observações */}
          {medicao.observacoes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Observações</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{medicao.observacoes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Dados gerais */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Informações</h2>

            <div>
              <p className="text-xs text-gray-400">Contrato</p>
              <p className="text-sm font-medium text-gray-900">{medicao.contrato.number}</p>
              <p className="text-xs text-gray-500">{medicao.contrato.name}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Competência</p>
              <p className="text-sm font-medium text-gray-900">{mesLabel} / {medicao.competenciaAno}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Criado por</p>
              <p className="text-sm text-gray-900">{medicao.createdBy.name}</p>
            </div>

            {medicao.aprovador && (
              <div>
                <p className="text-xs text-gray-400">Aprovado por</p>
                <p className="text-sm text-gray-900">{medicao.aprovador.name}</p>
                {medicao.dataAprovacao && (
                  <p className="text-xs text-gray-400">{new Date(medicao.dataAprovacao).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
            )}

            {medicao.dataPagamento && (
              <div>
                <p className="text-xs text-gray-400">Data do pagamento</p>
                <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  {new Date(medicao.dataPagamento).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          {/* Conferência do supervisor */}
          {(medicao.supervisorNota || medicao.status === 'aguard_supervisor') && (
            <div className={`rounded-xl border p-5 space-y-3 ${medicao.supervisorAprovadoEm ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className={`w-4 h-4 ${medicao.supervisorAprovadoEm ? 'text-green-600' : 'text-amber-600'}`} />
                <span className={medicao.supervisorAprovadoEm ? 'text-green-800' : 'text-amber-800'}>
                  Conferência do Supervisor
                </span>
              </h2>

              {medicao.supervisor ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Supervisor</p>
                    <p className="text-sm font-medium text-gray-900">{medicao.supervisor.name}</p>
                    {medicao.supervisorAprovadoEm && (
                      <p className="text-xs text-gray-400">{new Date(medicao.supervisorAprovadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>
                  {medicao.supervisorNota && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nota de conferência</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white/60 rounded-lg p-2 border border-white">
                        {medicao.supervisorNota}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-700">Aguardando ação do supervisor de obra.</p>
              )}
            </div>
          )}

          {/* Timeline de etapas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Etapas
            </h2>
            <ol className="relative space-y-4">
              {timeline.map((step, i) => {
                const StepIcon = step.icon
                const isLast = i === timeline.length - 1
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-blue-600' : 'bg-gray-100 border border-gray-200'}`}>
                        <StepIcon className={`w-3.5 h-3.5 ${step.done ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      {!isLast && <div className={`w-px flex-1 mt-1 ${step.done ? 'bg-blue-200' : 'bg-gray-100'}`} style={{ minHeight: 16 }} />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className={`text-xs font-medium ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{step.sublabel}</p>
                      {step.date && (
                        <p className="text-xs text-blue-600 mt-0.5">{new Date(step.date).toLocaleDateString('pt-BR')}</p>
                      )}
                      {step.nota && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{step.nota.slice(0, 80)}{step.nota.length > 80 ? '…' : ''}"</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
