'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

type ExtensionRequest = {
  id: string
  proposedDate: string | Date
  justification: string
  status: string
  reviewNote: string | null
  createdAt: string | Date
  requestedBy: { id: string; name: string }
  reviewedBy: { id: string; name: string } | null
  reviewedAt: string | Date | null
}

interface Props {
  demandId: string
  currentDueDate: Date
  requests: ExtensionRequest[]
  canRequest: boolean
  canReview: boolean
}

const STATUS_META = {
  pending:  { label: 'Aguardando revisão', cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Clock },
  approved: { label: 'Aprovada',            cls: 'bg-green-50 text-green-700 border-green-200',  icon: CheckCircle2 },
  rejected: { label: 'Rejeitada',           cls: 'bg-red-50 text-red-700 border-red-200',        icon: XCircle },
}

export function DeadlineExtensionPanel({ demandId, currentDueDate, requests, canRequest, canReview }: Props) {
  const router = useRouter()
  const [showForm, setShowForm]         = useState(false)
  const [showHistory, setShowHistory]   = useState(false)
  const [proposedDate, setProposedDate] = useState('')
  const [justification, setJustification] = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [reviewNote, setReviewNote]     = useState<Record<string, string>>({})
  const [reviewing, setReviewing]       = useState<string | null>(null)

  const pending = requests.find((r) => r.status === 'pending')
  const history = requests.filter((r) => r.status !== 'pending')
  const hasPending = Boolean(pending)

  async function submitRequest() {
    if (!proposedDate || !justification.trim()) {
      return setError('Preencha a nova data e a justificativa')
    }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/demands/${demandId}/deadline-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedDate, justification }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao enviar solicitação')
      setShowForm(false); setProposedDate(''); setJustification('')
      router.refresh()
    } finally { setSaving(false) }
  }

  async function review(reqId: string, action: 'approve' | 'reject') {
    setReviewing(reqId)
    try {
      const res = await fetch(`/api/demands/${demandId}/deadline-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote: reviewNote[reqId] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Erro ao revisar'); return }
      router.refresh()
    } finally { setReviewing(null) }
  }

  const minDate = new Date(currentDueDate)
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          Prorrogação de Prazo
        </h3>

        {canRequest && !hasPending && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Solicitar prorrogação
          </button>
        )}
      </div>

      {/* Solicitação pendente */}
      {pending && (
        <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
              <Clock className="w-3 h-3" /> Aguardando revisão
            </span>
            <span className="text-xs text-gray-500">por {pending.requestedBy.name} · {timeAgo(new Date(pending.createdAt))}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5">Prazo atual</p>
              <p className="font-medium text-gray-700">{new Date(currentDueDate).toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Novo prazo proposto</p>
              <p className="font-medium text-blue-700">{new Date(pending.proposedDate).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-0.5">Justificativa</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{pending.justification}</p>
          </div>

          {canReview && (
            <div className="pt-2 border-t border-amber-200 space-y-2">
              <input
                type="text"
                placeholder="Observação (opcional)"
                value={reviewNote[pending.id] ?? ''}
                onChange={(e) => setReviewNote((p) => ({ ...p, [pending.id]: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => review(pending.id, 'approve')}
                  disabled={reviewing === pending.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {reviewing === pending.id ? 'Salvando…' : 'Aprovar'}
                </button>
                <button
                  onClick={() => review(pending.id, 'reject')}
                  disabled={reviewing === pending.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Rejeitar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulário de nova solicitação */}
      {showForm && (
        <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-blue-800">Nova solicitação de prorrogação</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Prazo atual</label>
              <p className="text-sm font-medium text-gray-700 px-2.5 py-1.5 bg-gray-100 rounded-lg">
                {currentDueDate.toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Novo prazo proposto *</label>
              <input
                type="date"
                min={minDateStr}
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Justificativa *</label>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva o motivo da solicitação de prorrogação…"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submitRequest}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enviando…' : 'Enviar solicitação'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {history.length} solicitação{history.length !== 1 ? 'ões' : ''} anterior{history.length !== 1 ? 'es' : ''}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map((r) => {
                const meta = STATUS_META[r.status as keyof typeof STATUS_META] ?? STATUS_META.rejected
                const Icon = meta.icon
                return (
                  <div key={r.id} className={`border rounded-lg p-3 text-xs ${meta.cls}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      <span className="text-gray-500">por {r.requestedBy.name} · {timeAgo(new Date(r.createdAt))}</span>
                    </div>
                    <p className="text-gray-600">
                      Proposto: <span className="font-medium">{new Date(r.proposedDate).toLocaleDateString('pt-BR')}</span>
                    </p>
                    <p className="text-gray-500 mt-0.5 italic">"{r.justification}"</p>
                    {r.reviewedBy && (
                      <p className="text-gray-400 mt-1">
                        Revisado por {r.reviewedBy.name}
                        {r.reviewNote && <> · "{r.reviewNote}"</>}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!pending && !showForm && requests.length === 0 && (
        <p className="text-xs text-gray-400">Nenhuma solicitação de prorrogação registrada.</p>
      )}
    </div>
  )
}
