import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canViewRental } from '@/lib/permissions'
import Link from 'next/link'
import { PendenciaAcoesBtn } from '@/components/frota/PendenciaAcoesBtn'
import { AlertTriangle, ArrowLeft, Calendar, Package } from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberta:       { label: 'Aberta',       cls: 'bg-red-50 text-red-700 border-red-200' },
  em_tratativa: { label: 'Em tratativa', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolvida:    { label: 'Resolvida',    cls: 'bg-green-50 text-green-700 border-green-200' },
  reincidente:  { label: 'Reincidente',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
}

export default async function EquipamentosPendenciaDetalhePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!canViewRental(session)) redirect('/dashboard')

  const pendencia = await prisma.pendenciaAuditoria.findUnique({
    where: { id: params.id },
    include: {
      visita:      { select: { id: true, dataVisita: true, contrato: { select: { number: true, name: true } }, projeto: { select: { name: true } } } },
      responsavel: { select: { id: true, name: true } },
      item:        { select: { descricao: true, conformidade: true, observacao: true, ativo: { select: { id: true, tag: true, descricao: true } } } },
    },
  })

  if (!pendencia) redirect('/equipamentos/auditorias/pendencias')

  const stt = STATUS_META[pendencia.status] ?? STATUS_META.aberta
  const hoje = new Date()
  const vencida = pendencia.prazo && new Date(pendencia.prazo) < hoje && pendencia.status !== 'resolvida'

  const canGestor = ['master', 'admin', 'manager', 'supervisor'].includes(session.user.role)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/equipamentos/auditorias/pendencias" className="mt-1 p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Pendência
              </h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${stt.cls}`}>
                {stt.label}
              </span>
              <span className={`text-xs font-semibold uppercase tracking-wide ${pendencia.severidade === 'critica' ? 'text-red-600' : 'text-amber-600'}`}>
                {pendencia.severidade}
              </span>
              {vencida && <span className="text-xs font-medium text-red-600">• Vencida</span>}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{pendencia.descricao}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Detalhes */}
        <div className="space-y-4">
          {/* Item de auditoria */}
          {pendencia.item && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Item inspecionado
              </h2>
              <div>
                <p className="text-xs text-gray-400">Ativo</p>
                <Link href={`/equipamentos/ativos/${pendencia.item.ativo.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                  {pendencia.item.ativo.tag}
                </Link>
                <p className="text-xs text-gray-500">{pendencia.item.ativo.descricao}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Descrição da inspeção</p>
                <p className="text-sm text-gray-700">{pendencia.item.descricao}</p>
              </div>
              {pendencia.item.observacao && (
                <div>
                  <p className="text-xs text-gray-400">Observação do auditor</p>
                  <p className="text-sm text-gray-600 italic">{pendencia.item.observacao}</p>
                </div>
              )}
            </div>
          )}

          {/* Visita */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Visita de origem
            </h2>
            <div>
              <p className="text-xs text-gray-400">Data</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(pendencia.visita.dataVisita).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {pendencia.visita.contrato && (
              <div>
                <p className="text-xs text-gray-400">Contrato</p>
                <p className="text-sm text-gray-900">{pendencia.visita.contrato.number} — {pendencia.visita.contrato.name}</p>
              </div>
            )}
            <Link href={`/equipamentos/auditorias/${pendencia.visitaId}`} className="text-xs text-blue-600 hover:underline">
              Ver auditoria →
            </Link>
          </div>
        </div>

        {/* Gestão */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Gestão da pendência</h2>

            {pendencia.prazo && (
              <div>
                <p className="text-xs text-gray-400">Prazo</p>
                <p className={`text-sm font-medium ${vencida ? 'text-red-600' : 'text-gray-900'}`}>
                  {new Date(pendencia.prazo).toLocaleDateString('pt-BR')}
                  {vencida && ' (vencida)'}
                </p>
              </div>
            )}

            {pendencia.responsavel && (
              <div>
                <p className="text-xs text-gray-400">Responsável</p>
                <p className="text-sm text-gray-900">{pendencia.responsavel.name}</p>
              </div>
            )}

            {pendencia.resolucaoNota && (
              <div>
                <p className="text-xs text-gray-400">Nota de resolução</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{pendencia.resolucaoNota}</p>
              </div>
            )}

            {pendencia.resolvidaEm && (
              <div>
                <p className="text-xs text-gray-400">Resolvida em</p>
                <p className="text-sm font-medium text-green-700">
                  {new Date(pendencia.resolvidaEm).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          {canGestor && pendencia.status !== 'resolvida' && (
            <PendenciaAcoesBtn pendenciaId={pendencia.id} status={pendencia.status as any} />
          )}
        </div>
      </div>
    </div>
  )
}
