import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ChevronLeft, Package, Truck, Tag, Banknote, Calendar, Wrench, ClipboardCheck, Receipt, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { AlocarAtivoModal } from '@/components/frota/AlocarAtivoModal'
import { DesalocarAtivoBtn } from '@/components/frota/DesalocarAtivoBtn'
import { NovaOSModal } from '@/components/frota/NovaOSModal'

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  disponivel: { label: 'Disponível',  cls: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-400' },
  alocado:    { label: 'Alocado',     cls: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400' },
  manutencao: { label: 'Manutenção',  cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  inativo:    { label: 'Inativo',     cls: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-300' },
}

const OS_META: Record<string, { label: string; cls: string }> = {
  aberta:      { label: 'Aberta',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  em_execucao: { label: 'Em execução',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  concluida:   { label: 'Concluída',    cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelada:   { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const CONF_META: Record<string, { label: string; cls: string }> = {
  ok:      { label: 'Conforme',    cls: 'text-green-600' },
  atencao: { label: 'Atenção',     cls: 'text-amber-600' },
  critica: { label: 'Crítica',     cls: 'text-red-600' },
}

export default async function FrotaAtivoDetalhePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const ativo = await prisma.ativo.findUnique({
    where: { id: params.id },
    include: {
      alocacoes: {
        orderBy: { dataInicio: 'desc' },
        include: {
          contrato: { select: { id: true, number: true, name: true } },
          projeto:  { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
        },
      },
      ordensServico: {
        orderBy: { dataAbertura: 'desc' },
        include: { createdBy: { select: { name: true } } },
        take: 10,
      },
      auditoriaItens: {
        orderBy: { visita: { dataVisita: 'desc' } },
        include: {
          visita: {
            select: { id: true, dataVisita: true, auditor: { select: { name: true } } },
          },
          pendencia: { select: { id: true, status: true, severidade: true } },
        },
        take: 12,
      },
      medicaoItens: {
        orderBy: [{ medicao: { competenciaAno: 'desc' } }, { medicao: { competenciaMes: 'desc' } }],
        include: {
          medicao: { select: { id: true, competenciaAno: true, competenciaMes: true, status: true, contrato: { select: { number: true } } } },
          projeto: { select: { name: true } },
        },
        take: 12,
      },
    },
  })

  if (!ativo) notFound()

  const statusMeta   = STATUS_META[ativo.status] ?? STATUS_META.disponivel
  const alocacaoAtiva = ativo.alocacoes.find((a) => !a.dataFim)
  const alocacoesHist = ativo.alocacoes.filter((a) => a.dataFim)
  const osAbertas     = ativo.ordensServico.filter((o) => ['aberta', 'em_execucao'].includes(o.status))
  const osHist        = ativo.ordensServico.filter((o) => ['concluida', 'cancelada'].includes(o.status))
  const canEdit       = ['master', 'admin', 'manager'].includes(session.user.role)
  const TipoIcon      = ativo.tipo === 'veiculo' ? Truck : Package

  const custoTotalOS = ativo.ordensServico
    .filter((o) => o.status === 'concluida' && o.custo)
    .reduce((acc, o) => acc + (o.custo ?? 0), 0)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <Link href="/frota/ativos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" /> Ativos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            <TipoIcon className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-blue-700 font-bold text-lg">{ativo.tag}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusMeta.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ativo.descricao}</h1>
            <p className="text-sm text-gray-500">{ativo.tipo === 'equipamento' ? 'Equipamento' : 'Veículo'} · {ativo.categoria}</p>
          </div>
        </div>

        {/* Ações */}
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            {ativo.status === 'disponivel' && <AlocarAtivoModal ativoId={ativo.id} ativoTag={ativo.tag} ativoDescricao={ativo.descricao} />}
            {ativo.status === 'alocado'    && <DesalocarAtivoBtn ativoId={ativo.id} ativoTag={ativo.tag} />}
            {ativo.status !== 'inativo'    && <NovaOSModal ativoId={ativo.id} ativoTag={ativo.tag} />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Alocação atual */}
          {alocacaoAtiva ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Alocação atual</p>
              <p className="font-semibold text-gray-900 text-lg">{alocacaoAtiva.contrato.number} — {alocacaoAtiva.contrato.name}</p>
              {alocacaoAtiva.projeto && <p className="text-sm text-gray-600 mt-0.5">{alocacaoAtiva.projeto.name}</p>}
              <p className="text-xs text-gray-500 mt-2">Desde {formatDate(alocacaoAtiva.dataInicio)} · Alocado por {alocacaoAtiva.createdBy.name}</p>
            </div>
          ) : ativo.status === 'disponivel' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Disponível para alocação</p>
                <p className="text-sm text-green-600">Use o botão "Alocar" para vincular a um contrato</p>
              </div>
            </div>
          ) : ativo.status === 'manutencao' ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-orange-800">Em manutenção</p>
                <p className="text-sm text-orange-600">{osAbertas.length} OS ativa{osAbertas.length !== 1 ? 's' : ''} em andamento</p>
              </div>
            </div>
          ) : null}

          {/* OS abertas */}
          {osAbertas.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-orange-500" /> OS Ativas ({osAbertas.length})
              </h2>
              <div className="space-y-2">
                {osAbertas.map((os) => {
                  const meta = OS_META[os.status] ?? OS_META.aberta
                  const vencida = os.dataPrevista && new Date(os.dataPrevista) < new Date()
                  return (
                    <div key={os.id} className={`bg-white rounded-xl border p-4 ${vencida ? 'border-red-200' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>{meta.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${os.tipo === 'corretiva' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                              {os.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'}
                            </span>
                            {vencida && <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencida</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900">{os.descricao}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Aberta {formatDate(os.dataAbertura)} · {os.createdBy.name}
                            {os.dataPrevista && ` · Prevista: ${formatDate(os.dataPrevista)}`}
                          </p>
                          {os.executante && <p className="text-xs text-gray-500 mt-0.5">Executante: {os.executante}</p>}
                        </div>
                        {os.custo != null && (
                          <p className="text-sm font-semibold text-gray-700 flex-shrink-0">
                            {os.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Auditorias recentes */}
          {ativo.auditoriaItens.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-green-500" /> Últimas auditorias
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {ativo.auditoriaItens.slice(0, 8).map((item) => {
                  const confMeta = CONF_META[item.conformidade] ?? CONF_META.ok
                  return (
                    <Link key={item.id} href={`/frota/auditorias/${item.visita.id}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{item.descricao}</p>
                        <p className="text-xs text-gray-400">{item.categoria} · {formatDate(item.visita.dataVisita)} · {item.visita.auditor.name}</p>
                      </div>
                      <span className={`text-xs font-medium ${confMeta.cls} flex-shrink-0`}>{confMeta.label}</span>
                      {item.pendencia && item.pendencia.status !== 'resolvida' && (
                        <span className="text-xs text-amber-600 flex-shrink-0">Pendente</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Histórico de alocações */}
          {alocacoesHist.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" /> Histórico de alocações
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {alocacoesHist.map((aloc) => (
                  <div key={aloc.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{aloc.contrato.number} — {aloc.contrato.name}</p>
                      {aloc.projeto && <p className="text-xs text-gray-400">{aloc.projeto.name}</p>}
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0 text-right">
                      {formatDate(aloc.dataInicio)} → {formatDate(aloc.dataFim)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-5">
          {/* Dados do ativo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Dados do ativo</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400 flex items-center gap-1"><Tag className="w-3 h-3" /> TAG</dt>
                <dd className="font-mono font-bold text-blue-700">{ativo.tag}</dd>
              </div>
              {ativo.placa && (
                <div>
                  <dt className="text-xs text-gray-400">Placa</dt>
                  <dd className="font-mono font-medium">{ativo.placa}</dd>
                </div>
              )}
              {ativo.marca && (
                <div>
                  <dt className="text-xs text-gray-400">Marca / Modelo</dt>
                  <dd>{[ativo.marca, ativo.modelo].filter(Boolean).join(' ')}</dd>
                </div>
              )}
              {ativo.anoFabricacao && (
                <div>
                  <dt className="text-xs text-gray-400">Ano</dt>
                  <dd>{ativo.anoFabricacao}</dd>
                </div>
              )}
              {ativo.numeroserie && (
                <div>
                  <dt className="text-xs text-gray-400">Nº Série / Chassi</dt>
                  <dd className="font-mono text-xs break-all">{ativo.numeroserie}</dd>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <dt className="text-xs text-gray-400 flex items-center gap-1"><Banknote className="w-3 h-3" /> Locação / mês</dt>
                <dd className="text-lg font-bold text-gray-900">
                  {ativo.valorLocacaoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Resumo de OS */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Manutenção
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">OS abertas</dt>
                <dd className={`font-semibold ${osAbertas.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{osAbertas.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">OS históricas</dt>
                <dd className="text-gray-700">{osHist.length}</dd>
              </div>
              {custoTotalOS > 0 && (
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <dt className="text-gray-500">Custo total</dt>
                  <dd className="font-semibold text-gray-900">{custoTotalOS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd>
                </div>
              )}
            </dl>
            {osHist.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                {osHist.slice(0, 3).map((os) => (
                  <div key={os.id} className="flex items-center justify-between text-xs text-gray-500">
                    <span className="truncate mr-2">{os.descricao}</span>
                    <span className="flex-shrink-0">{formatDate(os.dataConclusao ?? os.dataAbertura)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medições recentes */}
          {ativo.medicaoItens.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Medições recentes
              </h3>
              <div className="space-y-2">
                {ativo.medicaoItens.slice(0, 6).map((item) => (
                  <Link key={item.id} href={`/frota/medicoes/${item.medicao.id}`} className="flex items-center justify-between text-xs hover:bg-gray-50 rounded p-1 -mx-1 transition-colors">
                    <span className="text-gray-600">{String(item.medicao.competenciaMes).padStart(2, '0')}/{item.medicao.competenciaAno}</span>
                    <span className="font-medium text-gray-900">{item.totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {ativo.observacoes && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observações</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ativo.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
