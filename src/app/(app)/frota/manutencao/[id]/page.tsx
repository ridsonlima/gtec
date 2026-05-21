import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove } from '@/lib/permissions'
import Link from 'next/link'
import { OSAcoesInline } from '@/components/frota/OSAcoesInline'
import {
  Wrench, ChevronLeft, Calendar, User, DollarSign,
  Clock, CheckCircle2, Play, XCircle, AlertTriangle, Car,
} from 'lucide-react'

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  aberta:      { label: 'Aberta',      cls: 'bg-gray-100 text-gray-600 border-gray-200',   icon: Clock },
  em_execucao: { label: 'Em execução', cls: 'bg-blue-50 text-blue-700 border-blue-200',    icon: Play },
  concluida:   { label: 'Concluída',   cls: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',   cls: 'bg-red-50 text-red-600 border-red-200',       icon: XCircle },
}

export default async function OSDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const os = await prisma.ordemServico.findUnique({
    where: { id: params.id },
    include: {
      ativo: {
        select: {
          id: true, tag: true, descricao: true, categoria: true,
          tipo: true, status: true, placa: true, marca: true, modelo: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!os) notFound()

  const canGestor = ['master', 'admin', 'manager'].includes(session.user.role)
  const meta = STATUS_META[os.status] ?? STATUS_META.aberta
  const StatusIcon = meta.icon
  const isCorretiva = os.tipo === 'corretiva'
  const hoje = new Date()
  const vencida = os.dataPrevista && new Date(os.dataPrevista) < hoje && !['concluida', 'cancelada'].includes(os.status)

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const fmtCurrency = (v: number | null | undefined) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  const backHref = os.ativo.tipo === 'veiculo' ? '/frota/manutencao' : '/equipamentos/manutencao'
  const ativoHref = os.ativo.tipo === 'veiculo' ? `/frota/ativos/${os.ativo.id}` : `/equipamentos/ativos/${os.ativo.id}`

  return (
    <div className="max-w-3xl space-y-5">
      {/* Voltar */}
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" /> Manutenção
      </Link>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
              <StatusIcon className="w-3 h-3" />
              {meta.label}
            </span>
            <span className={`text-xs font-bold uppercase tracking-wide ${isCorretiva ? 'text-red-600' : 'text-blue-600'}`}>
              {os.tipo}
            </span>
            {vencida && (
              <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Prazo vencido
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-gray-400" />
            {os.ativo.tag}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{os.descricao}</p>
        </div>

        {/* Ações */}
        {canGestor && !['concluida', 'cancelada'].includes(os.status) && (
          <OSAcoesInline osId={os.id} status={os.status as any} role={session.user.role} />
        )}
      </div>

      {/* Ativo / Veículo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5" />
            {os.ativo.tipo === 'veiculo' ? 'Veículo' : 'Equipamento'}
          </p>
          <Link href={ativoHref} className="text-xs text-blue-600 hover:underline">
            Ver ficha completa →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Info label="Tag / Código" value={os.ativo.tag} />
          {os.ativo.descricao && <Info label="Descrição" value={os.ativo.descricao} />}
          {os.ativo.placa && <Info label="Placa" value={os.ativo.placa} />}
          {(os.ativo.marca || os.ativo.modelo) && (
            <Info label="Marca / Modelo" value={[os.ativo.marca, os.ativo.modelo].filter(Boolean).join(' ')} />
          )}
          {os.ativo.categoria && <Info label="Categoria" value={os.ativo.categoria} />}
        </div>
      </div>

      {/* Detalhes da OS */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Detalhes da OS</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Data de abertura" value={fmt(os.dataAbertura)} />
          <Info
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Prazo previsto"
            value={fmt(os.dataPrevista)}
            highlight={!!vencida}
          />
          {os.dataConclusao && (
            <Info icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Data de conclusão" value={fmt(os.dataConclusao)} />
          )}
          {os.executante && (
            <Info icon={<User className="w-3.5 h-3.5" />} label="Executante / Oficina" value={os.executante} />
          )}
          {os.custo != null && (
            <Info icon={<DollarSign className="w-3.5 h-3.5" />} label="Custo" value={fmtCurrency(os.custo)} />
          )}
          <Info icon={<User className="w-3.5 h-3.5" />} label="Aberto por" value={os.createdBy.name} />
        </div>

        {os.observacoes && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1.5">Observações</p>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{os.observacoes}</p>
          </div>
        )}
      </div>

      {/* Estado encerrado */}
      {['concluida', 'cancelada'].includes(os.status) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2
          ${os.status === 'concluida' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <StatusIcon className="w-4 h-4 flex-shrink-0" />
          {os.status === 'concluida'
            ? `OS concluída em ${fmt(os.dataConclusao)}`
            : 'OS cancelada — sem possibilidade de reabertura'}
        </div>
      )}
    </div>
  )
}

function Info({
  icon, label, value, highlight,
}: {
  icon?: React.ReactNode; label: string; value: string; highlight?: boolean
}) {
  return (
    <div>
      <p className={`text-xs flex items-center gap-1 mb-0.5 ${highlight ? 'text-red-500' : 'text-gray-400'}`}>
        {icon} {label}
      </p>
      <p className={`text-sm font-medium ${highlight ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
