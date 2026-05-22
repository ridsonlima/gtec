import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { AuditoriaAcoesBtn } from '@/components/frota/AuditoriaAcoesBtn'
import {
  ClipboardCheck, ArrowLeft, CheckCircle2, Clock, Play,
  XCircle, AlertTriangle, Package, Calendar,
} from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  agendada:     { label: 'Agendada',     cls: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock },
  em_andamento: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Play },
  concluida:    { label: 'Concluída',    cls: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2 },
  cancelada:    { label: 'Cancelada',    cls: 'bg-red-50 text-red-600 border-red-200',          icon: XCircle },
}

const CONF_META: Record<string, { label: string; cls: string; dot: string }> = {
  ok:      { label: 'OK',       cls: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500' },
  atencao: { label: 'Atenção',  cls: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-500' },
  critica: { label: 'Crítica',  cls: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-500' },
}

export default async function FrotaAuditoriaDetalhePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const visita = await prisma.auditoriaVisita.findUnique({
    where: { id: params.id },
    include: {
      auditor:  { select: { id: true, name: true } },
      contrato: { select: { id: true, number: true, name: true } },
      projeto:  { select: { id: true, name: true } },
      itens: {
        include: {
          ativo:    { select: { id: true, tag: true, descricao: true } },
          pendencia: {
            select: { id: true, status: true, severidade: true, prazo: true, responsavel: { select: { name: true } } },
          },
        },
        orderBy: { ativo: { tag: 'asc' } } as any,
      },
    },
  })

  if (!visita) redirect('/frota/auditorias')

  const meta = STATUS_META[visita.status] ?? STATUS_META.agendada
  const StatusIcon = meta.icon
  const dataVisita = new Date(visita.dataVisita)

  const totalItens  = visita.itens.length
  const okCount     = visita.itens.filter((i) => i.conformidade === 'ok').length
  const atencaoCount = visita.itens.filter((i) => i.conformidade === 'atencao').length
  const criticaCount = visita.itens.filter((i) => i.conformidade === 'critica').length

  const isAuditor = visita.auditorId === session.user.id
  const canGestor = ['master', 'admin', 'manager'].includes(session.user.role)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link href="/frota/auditorias" className="mt-1 p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                Auditoria — {dataVisita.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                <StatusIcon className="w-3 h-3" />
                {meta.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {visita.contrato ? `${visita.contrato.number} — ${visita.contrato.name}` : visita.projeto?.name ?? ''}
            </p>
          </div>
        </div>

        <AuditoriaAcoesBtn
          visitaId={visita.id}
          status={visita.status as any}
          isAuditor={isAuditor}
          canGestor={canGestor}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Itens do checklist */}
        <div className="lg:col-span-2 space-y-4">
          {/* Resumo conformidade */}
          {totalItens > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'OK', count: okCount, cls: 'text-green-600', bar: 'bg-green-500' },
                { label: 'Atenção', count: atencaoCount, cls: 'text-amber-600', bar: 'bg-amber-400' },
                { label: 'Crítica', count: criticaCount, cls: 'text-red-600', bar: 'bg-red-500' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-xl font-bold ${s.cls}`}>{s.count}</p>
                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full`} style={{ width: totalItens ? `${(s.count / totalItens) * 100}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de itens */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Checklist de inspeção
              </h2>
              <span className="text-xs text-gray-400">{totalItens} item{totalItens !== 1 ? 'ns' : ''}</span>
            </div>

            {visita.itens.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">Nenhum item registrado nesta visita</p>
                {(isAuditor || canGestor) && visita.status === 'em_andamento' && (
                  <p className="text-xs text-gray-400 mt-1">Adicione itens via app durante a inspeção</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {visita.itens.map((item) => {
                  const conf = CONF_META[item.conformidade] ?? CONF_META.ok
                  const pendVencida = item.pendencia?.prazo && new Date(item.pendencia.prazo) < new Date() && item.pendencia.status !== 'resolvida'

                  return (
                    <div key={item.id} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full ${conf.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-medium text-gray-900">{item.ativo.tag}</p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${conf.cls}`}>
                              {conf.label}
                            </span>
                            <span className="text-xs text-gray-400 uppercase tracking-wide">{item.categoria}</span>
                          </div>
                          <p className="text-sm text-gray-600">{item.descricao}</p>
                          {item.observacao && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{item.observacao}</p>
                          )}

                          {/* Pendência vinculada */}
                          {item.pendencia && (
                            <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 border ${pendVencida ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              <span>
                                Pendência {item.pendencia.status === 'resolvida' ? 'resolvida' : item.pendencia.status}
                                {item.pendencia.prazo && ` · prazo ${new Date(item.pendencia.prazo).toLocaleDateString('pt-BR')}`}
                                {item.pendencia.responsavel && ` · ${item.pendencia.responsavel.name}`}
                              </span>
                              <Link href={`/frota/auditorias/pendencias/${item.pendencia.id}`} className="ml-auto hover:underline">
                                ver →
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Observações */}
          {visita.observacoes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Observações</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{visita.observacoes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Informações</h2>

            <div>
              <p className="text-xs text-gray-400">Data da visita</p>
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {dataVisita.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>

            {visita.contrato && (
              <div>
                <p className="text-xs text-gray-400">Contrato</p>
                <p className="text-sm font-medium text-gray-900">{visita.contrato.number}</p>
                <p className="text-xs text-gray-500">{visita.contrato.name}</p>
              </div>
            )}

            {visita.projeto && (
              <div>
                <p className="text-xs text-gray-400">Projeto</p>
                <p className="text-sm text-gray-900">{visita.projeto.name}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-400">Auditor responsável</p>
              <p className="text-sm text-gray-900">{visita.auditor.name}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Progresso</h2>
            <ol className="relative border-l border-gray-200 space-y-3 ml-2">
              {[
                { label: 'Agendada', done: true },
                { label: 'Iniciada', done: ['em_andamento', 'concluida'].includes(visita.status) },
                { label: 'Concluída', done: visita.status === 'concluida' },
              ].map((step, i) => (
                <li key={i} className="ml-4">
                  <span className={`absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${step.done ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  <p className={`text-xs font-medium ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
