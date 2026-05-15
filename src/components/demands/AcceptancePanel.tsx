'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, AlertTriangle, ShieldAlert } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

type AcceptanceStatus = 'pending_acceptance' | 'accepted' | 'rejected'
type SlaStatus = 'ok' | 'warning' | 'breached'

interface Props {
  demandId: string
  acceptanceStatus: AcceptanceStatus
  slaStatus: SlaStatus | null
  slaDeadline: Date | null
  acceptedByName?: string | null
  acceptedAt?: Date | null
  rejectedByName?: string | null
  rejectedAt?: Date | null
  rejectionReason?: string | null
  canActOnBehalf: boolean // true se o usuário é gestor da área executora
}

export function AcceptancePanel({
  demandId, acceptanceStatus, slaStatus, slaDeadline,
  acceptedByName, acceptedAt, rejectedByName, rejectedAt, rejectionReason,
  canActOnBehalf,
}: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/demands/${demandId}/accept`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Erro ao aceitar')
      }
    },
    onSuccess: () => window.location.reload(),
    onError: (e: any) => setError(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error('Informe o motivo da rejeição')
      const res = await fetch(`/api/demands/${demandId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Erro ao rejeitar')
      }
    },
    onSuccess: () => window.location.reload(),
    onError: (e: any) => setError(e.message),
  })

  const slaColors: Record<SlaStatus, string> = {
    ok:      'border-blue-200 bg-blue-50',
    warning: 'border-amber-300 bg-amber-50',
    breached:'border-red-300 bg-red-50',
  }

  const slaIcons: Record<SlaStatus, React.ReactNode> = {
    ok:      <Clock className="w-4 h-4 text-blue-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    breached:<ShieldAlert className="w-4 h-4 text-red-500" />,
  }

  const slaTexts: Record<SlaStatus, string> = {
    ok:      'Prazo de aceite',
    warning: 'Prazo de aceite próximo do vencimento',
    breached:'Prazo de aceite vencido — escalado para a diretoria',
  }

  if (acceptanceStatus === 'accepted') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-800">Demanda aceita pela área executora</p>
          {acceptedByName && acceptedAt && (
            <p className="text-xs text-green-600 mt-0.5">
              {acceptedByName} · {formatDateTime(acceptedAt)}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (acceptanceStatus === 'rejected') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Demanda rejeitada pela área executora</p>
          {rejectedByName && rejectedAt && (
            <p className="text-xs text-red-600 mt-0.5">
              {rejectedByName} · {formatDateTime(rejectedAt)}
            </p>
          )}
          {rejectionReason && (
            <p className="text-sm text-red-700 mt-1.5 bg-red-100 rounded-lg px-3 py-2">
              <span className="font-medium">Motivo: </span>{rejectionReason}
            </p>
          )}
        </div>
      </div>
    )
  }

  // pending_acceptance
  const sl = slaStatus ?? 'ok'
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${slaColors[sl]}`}>
      <div className="flex items-center gap-2">
        {slaIcons[sl]}
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Aguardando aceite da área executora</p>
          <p className={`text-xs mt-0.5 ${sl === 'breached' ? 'text-red-600 font-medium' : sl === 'warning' ? 'text-amber-600' : 'text-gray-500'}`}>
            {slaTexts[sl]}
            {slaDeadline && ` · prazo: ${formatDateTime(slaDeadline)}`}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {canActOnBehalf && !showRejectForm && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {acceptMutation.isPending ? 'Aceitando...' : 'Aceitar demanda'}
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Rejeitar
          </button>
        </div>
      )}

      {canActOnBehalf && showRejectForm && (
        <div className="space-y-2 pt-1">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Informe o motivo da rejeição..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || !reason.trim()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {rejectMutation.isPending ? 'Rejeitando...' : 'Confirmar rejeição'}
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setReason('') }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
