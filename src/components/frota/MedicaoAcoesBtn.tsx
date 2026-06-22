'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, CheckCircle, XCircle, FileText, CreditCard,
  ClipboardCheck, RotateCcw, AlertCircle, Trash2, Pencil, Check, X,
} from 'lucide-react'

type Status = 'rascunho' | 'aguard_supervisor' | 'enviada' | 'aprovada' | 'guia_gerada' | 'paga' | 'rejeitada'

interface Props {
  medicaoId: string
  status: Status
  role: string
  observacoes?: string | null
}

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-700 mb-1'

export function MedicaoAcoesBtn({ medicaoId, status, role, observacoes: obsInicial }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Modals de fluxo
  const [showConferir, setShowConferir] = useState(false)
  const [showDevolver, setShowDevolver] = useState(false)
  const [showRejeitar, setShowRejeitar] = useState(false)
  const [showPagamento, setShowPagamento] = useState(false)

  // Excluir
  const [showExcluir, setShowExcluir] = useState(false)

  // Editar observações
  const [showEditObs, setShowEditObs] = useState(false)
  const [obsEdit, setObsEdit] = useState(obsInicial ?? '')

  const [notaSupervisor, setNotaSupervisor] = useState('')
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))

  const canGestor    = ['master', 'admin', 'manager'].includes(role)
  const canSupervisor = ['master', 'admin', 'director', 'manager', 'supervisor'].includes(role)
  const canMaster    = ['master', 'admin'].includes(role)

  async function action(endpoint: string, body?: object) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/frota/medicoes/${medicaoId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      router.refresh()
    } finally { setLoading(false) }
  }

  async function excluir() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/frota/medicoes/${medicaoId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao excluir'); return }
      router.push('/frota/medicoes')
    } finally { setLoading(false) }
  }

  async function salvarObs() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/frota/medicoes/${medicaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes: obsEdit.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
      setShowEditObs(false)
      router.refresh()
    } finally { setLoading(false) }
  }

  // Botão "Voltar etapa" — visível para master/admin em etapas intermediárias
  const podeVoltar = canMaster && ['aguard_supervisor', 'enviada', 'aprovada', 'guia_gerada'].includes(status)
  const ETAPA_ANTERIOR: Record<string, string> = {
    aguard_supervisor: 'Rascunho',
    enviada: 'Aguard. Supervisor',
    aprovada: 'Enviada',
    guia_gerada: 'Aprovada',
  }

  const podeEditar = canGestor && ['rascunho', 'rejeitada'].includes(status)
  const podeExcluir = canMaster && status === 'rascunho'

  return (
    <div className="flex flex-col gap-3 items-end">
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap justify-end">
        {/* ── Editar observações (rascunho/rejeitada) ── */}
        {podeEditar && !showEditObs && (
          <button
            onClick={() => setShowEditObs(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-600 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            title="Editar observações da medição"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar obs.
          </button>
        )}

        {/* ── Excluir (rascunho, master/admin) ── */}
        {podeExcluir && !showExcluir && (
          <button
            onClick={() => setShowExcluir(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-red-600 text-sm rounded-lg border border-red-200 hover:bg-red-50"
            title="Excluir esta medição"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
        )}

        {/* ── ETAPA 1: Rascunho ── */}
        {status === 'rascunho' && canGestor && (
          <button
            onClick={() => action('enviar')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Enviando…' : 'Enviar para supervisor'}
          </button>
        )}

        {/* ── ETAPA 2: Aguardando supervisor ── */}
        {status === 'aguard_supervisor' && canSupervisor && !showConferir && !showDevolver && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowConferir(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
            >
              <ClipboardCheck className="w-4 h-4" />
              Confirmar medição
            </button>
            <button
              onClick={() => setShowDevolver(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-amber-700 text-sm font-medium rounded-lg border border-amber-300 hover:bg-amber-50"
            >
              <XCircle className="w-4 h-4" />
              Devolver para correção
            </button>
          </div>
        )}

        {/* ── ETAPA 3: Enviada → aprovação gerencial ── */}
        {status === 'enviada' && canSupervisor && !showRejeitar && (
          <div className="flex gap-2">
            <button
              onClick={() => action('aprovar')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Aprovando…' : 'Aprovar'}
            </button>
            <button
              onClick={() => setShowRejeitar(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-700 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4" />
              Rejeitar
            </button>
          </div>
        )}

        {/* ── ETAPA 4: Aprovada → gerar guia ── */}
        {status === 'aprovada' && canGestor && (
          <button
            onClick={() => action('pagamento', { acao: 'gerar_guia' })}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {loading ? 'Gerando…' : 'Gerar guia de cobrança'}
          </button>
        )}

        {/* ── ETAPA 5: Guia gerada → registrar pagamento ── */}
        {status === 'guia_gerada' && canGestor && !showPagamento && (
          <button
            onClick={() => setShowPagamento(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <CreditCard className="w-4 h-4" />
            Registrar pagamento
          </button>
        )}

        {/* ── Botão Voltar Etapa (master/admin, etapas intermediárias) ── */}
        {podeVoltar && (
          <button
            onClick={() => {
              if (!confirm(`Retornar para "${ETAPA_ANTERIOR[status]}"? Os dados da etapa atual serão limpos.`)) return
              action('voltar')
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-600 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            title={`Retornar para: ${ETAPA_ANTERIOR[status]}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Voltar etapa
          </button>
        )}
      </div>

      {/* ── Modal: Supervisor confirma (nota obrigatória) ── */}
      {showConferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-green-600" />
              <h3 className="text-base font-semibold text-gray-900">Confirmar medição</h3>
            </div>
            <p className="text-sm text-gray-500">
              Ao confirmar, você atesta que verificou os itens, os dias ativos e os valores desta medição estão corretos.
            </p>
            <div>
              <label className={LABEL}>
                Nota de conferência <span className="text-red-500">*</span>
              </label>
              <textarea
                value={notaSupervisor}
                onChange={(e) => setNotaSupervisor(e.target.value)}
                rows={3}
                placeholder="Ex: Verifiquei in loco os veículos alocados. Os dias estão corretos conforme relatório de campo de março/2026."
                className={`${INPUT} resize-none`}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Descreva o que foi verificado. Este campo é obrigatório.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowConferir(false); setNotaSupervisor('') }}
                className="px-4 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => action('conferir', { acao: 'confirmar', nota: notaSupervisor })}
                disabled={loading || !notaSupervisor.trim()}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Confirmando…' : 'Confirmar e avançar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Supervisor devolve para correção ── */}
      {showDevolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-semibold text-gray-900">Devolver para correção</h3>
            </div>
            <p className="text-sm text-gray-500">
              A medição voltará para rascunho. O gestor poderá corrigir os itens e reenviar.
            </p>
            <div>
              <label className={LABEL}>
                Motivo da devolução <span className="text-red-500">*</span>
              </label>
              <textarea
                value={notaSupervisor}
                onChange={(e) => setNotaSupervisor(e.target.value)}
                rows={3}
                placeholder="Ex: O veículo VEI-012 esteve em manutenção nos dias 10 a 15. Corrija os dias ativos."
                className={`${INPUT} resize-none`}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Explique o que precisa ser corrigido. Campo obrigatório.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowDevolver(false); setNotaSupervisor('') }}
                className="px-4 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => action('conferir', { acao: 'devolver', nota: notaSupervisor })}
                disabled={loading || !notaSupervisor.trim()}
                className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Devolvendo…' : 'Devolver para gestor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Rejeição gerencial ── */}
      {showRejeitar && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 w-full max-w-sm">
          <p className="text-sm font-medium text-red-800">Motivo da rejeição</p>
          <textarea
            value={motivoRejeicao}
            onChange={(e) => setMotivoRejeicao(e.target.value)}
            rows={2}
            placeholder="Descreva o motivo da rejeição…"
            className={`${INPUT} resize-none`}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowRejeitar(false); setMotivoRejeicao('') }}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => action('rejeitar', { motivo: motivoRejeicao })}
              disabled={loading || !motivoRejeicao.trim()}
              className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Rejeitando…' : 'Confirmar rejeição'}
            </button>
          </div>
        </div>
      )}

      {/* ── Inline: Editar observações ── */}
      {showEditObs && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 w-full max-w-sm">
          <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            Editar observações
          </p>
          <textarea
            value={obsEdit}
            onChange={(e) => setObsEdit(e.target.value)}
            rows={3}
            placeholder="Informações adicionais para esta medição…"
            className={`${INPUT} resize-none`}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowEditObs(false); setObsEdit(obsInicial ?? '') }}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg"
            >
              <X className="w-3 h-3 inline mr-1" />Cancelar
            </button>
            <button
              onClick={salvarObs}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="w-3 h-3 inline mr-1" />{loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmação de exclusão ── */}
      {showExcluir && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 w-full max-w-sm">
          <p className="text-sm font-medium text-red-800 flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            Excluir medição?
          </p>
          <p className="text-xs text-red-700">
            Esta ação é irreversível. Todos os itens desta medição serão removidos permanentemente.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExcluir(false)}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={excluir}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Excluindo…' : 'Sim, excluir'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar pagamento ── */}
      {showPagamento && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3 w-full max-w-sm">
          <p className="text-sm font-medium text-green-800">Dados do pagamento</p>
          <div>
            <label className={LABEL}>Data de pagamento</label>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className={INPUT}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPagamento(false)}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => action('pagamento', { acao: 'registrar_pagamento', dataPagamento })}
              disabled={loading || !dataPagamento}
              className="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Registrando…' : 'Confirmar pagamento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
