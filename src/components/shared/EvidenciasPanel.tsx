import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Eye, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { EvidenciaActions } from '@/components/evidencias/EvidenciaActions'

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pendente',  cls: 'text-amber-700 bg-amber-50 border-amber-200',  icon: <Clock className="w-3 h-3" /> },
  received: { label: 'Recebida',  cls: 'text-green-700 bg-green-50 border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: 'Rejeitada', cls: 'text-red-700 bg-red-50 border-red-200',        icon: <AlertCircle className="w-3 h-3" /> },
}

type Props =
  | { objectType: 'demand'; objectId: string }
  | { objectType: 'report'; objectId: string }

export async function EvidenciasPanel({ objectType, objectId }: Props) {
  const session = await auth()
  if (!session) return null

  const where = objectType === 'demand'
    ? { demandRef: { id: objectId } }
    : { reportRef: { id: objectId } }

  const evidenceRequests = await prisma.evidenceRequest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    include: {
      responsible: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  })

  const pending = evidenceRequests.filter((e) => e.status === 'pending').length

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-500" />
          Evidências
          {evidenceRequests.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({evidenceRequests.length})</span>
          )}
          {pending > 0 && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              {pending} pendente{pending !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
      </div>

      {evidenceRequests.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
          Nenhum pedido de evidência vinculado
        </div>
      ) : (
        <div className="space-y-2">
          {evidenceRequests.map((ev) => {
            const cfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pending
            const isOverdue = ev.status === 'pending' && ev.dueDate && new Date(ev.dueDate) < new Date()
            const isRequester = ev.requestedById === session.user.id

            return (
              <div
                key={ev.id}
                className={`bg-white rounded-xl border px-4 py-3 ${isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.cls}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                      {isOverdue && <span className="text-xs font-bold text-red-600">VENCIDA</span>}
                    </div>
                    <p className="text-sm text-gray-800">{ev.description}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      <span>Solicitado por <strong>{ev.requestedBy.name}</strong></span>
                      <span>Para <strong>{ev.responsible.name}</strong></span>
                      {ev.dueDate && (
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          Prazo: {formatDate(ev.dueDate)}
                        </span>
                      )}
                    </div>
                    {ev.responseNotes && ev.status !== 'pending' && (
                      <p className="mt-1.5 text-xs text-gray-500 italic bg-gray-50 rounded px-2 py-1">"{ev.responseNotes}"</p>
                    )}
                    <EvidenciaActions evidenceId={ev.id} currentStatus={ev.status} isRequester={isRequester} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
