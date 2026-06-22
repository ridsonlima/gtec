'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { ChevronDown, CheckCircle, XCircle, Loader2, ClipboardCheck } from 'lucide-react'
import type { Session } from 'next-auth'

type DemandStatus = 'pending' | 'in_progress' | 'pending_approval' | 'blocked' | 'completed' | 'cancelled'

const TRANSITIONS: Record<DemandStatus, { value: DemandStatus; label: string }[]> = {
  pending:          [{ value: 'in_progress', label: 'Iniciar' }, { value: 'cancelled', label: 'Cancelar' }],
  in_progress:      [{ value: 'pending_approval', label: 'Enviar para Aprovação' }, { value: 'blocked', label: 'Marcar Bloqueada' }, { value: 'completed', label: 'Concluir' }, { value: 'cancelled', label: 'Cancelar' }],
  pending_approval: [{ value: 'in_progress', label: 'Aprovar / Retomar' }, { value: 'blocked', label: 'Marcar Bloqueada' }, { value: 'cancelled', label: 'Cancelar' }],
  blocked:          [{ value: 'in_progress', label: 'Retomar' }, { value: 'cancelled', label: 'Cancelar' }],
  completed:        [],
  cancelled:        [],
}

const STATUS_LABELS: Record<DemandStatus, string> = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  pending_approval: 'Em aprovação',
  blocked:          'Bloqueada',
  completed:        'Concluída',
  cancelled:        'Cancelada',
}

interface Props {
  demandId: string
  currentStatus: string
  session: Session
}

export function DemandActions({ demandId, currentStatus, session }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pendingStatus, setPendingStatus] = useState<DemandStatus | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)

  const transitions = TRANSITIONS[currentStatus as DemandStatus] ?? []

  const updateMutation = useMutation({
    mutationFn: async ({ status, content }: { status: DemandStatus; content?: string }) => {
      // The updates API handles both the update record and demand status change
      const res = await fetch(`/api/demands/${demandId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content || `Status alterado para: ${STATUS_LABELS[status]}`,
          statusAfter: status,
        }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar status')
    },
    onSuccess: () => {
      setOpen(false)
      setShowNoteModal(false)
      setNote('')
      setPendingStatus(null)
      router.refresh()
    },
  })

  const handleTransition = (status: DemandStatus) => {
    setPendingStatus(status)
    setOpen(false)
    setShowNoteModal(true)
  }

  const confirmTransition = () => {
    if (!pendingStatus) return
    updateMutation.mutate({ status: pendingStatus, content: note.trim() || undefined })
  }

  if (transitions.length === 0) return null

  return (
    <>
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200
                     text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Atualizar Status
          <ChevronDown className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200
                            rounded-xl shadow-lg py-1 min-w-[180px]">
              {transitions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTransition(t.value)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors
                             flex items-center gap-2"
                >
                  {t.value === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {t.value === 'cancelled' && <XCircle className="w-4 h-4 text-red-400" />}
                  {t.value === 'pending_approval' && <ClipboardCheck className="w-4 h-4 text-amber-500" />}
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Note modal */}
      {showNoteModal && pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              {STATUS_LABELS[pendingStatus]}
            </h3>
            <p className="text-sm text-gray-500">
              Adicione uma nota sobre esta mudança de status (opcional).
            </p>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Aprovação da PCA recebida, iniciando mobilização..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowNoteModal(false); setPendingStatus(null); setNote('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmTransition}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                           text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
