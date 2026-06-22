import { getApprovoAlertsByContract, getApprovoCredsForUser } from '@/lib/approvoService'
import { CRITICIDADE_META } from '@/types/approvo'
import { CadeiaAprovacao } from '@/components/approvo/CadeiaAprovacao'
import { ClipboardCheck, AlertTriangle, ExternalLink, UserCheck } from 'lucide-react'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Bloco "Aprovações pendentes do contrato" para a página de detalhe do contrato.
 * Mostra apenas as aprovações da fila do PRÓPRIO usuário (privacidade).
 */
export async function AprovacoesContrato({ userId, referencias }: { userId: string; referencias: string[] }) {
  const creds = await getApprovoCredsForUser(userId)
  if (!creds) return null
  const alerts = await getApprovoAlertsByContract(creds, referencias)
  if (alerts.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">Aprovações pendentes do contrato</h2>
        <span className="ml-auto text-xs text-gray-400">{alerts.length} pendente{alerts.length > 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {alerts.map((a) => {
          const meta = CRITICIDADE_META[a.criticidade]
          return (
            <div key={a.id} className="px-5 py-3 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{a.tipo_documento}</span>
                    <span className="text-xs text-gray-400 font-mono">{a.numero_documento}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                      {a.criticidade === 'critico' && <AlertTriangle className="w-3 h-3" />}
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{a.descricao}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{fmtBRL(a.valor)}</p>
                  <p className="text-xs text-gray-400">{a.dias_pendente}d pendente</p>
                </div>
                <a
                  href={a.link_approvo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Approvo
                </a>
              </div>

              {a.proximo_aprovador && (
                <div className="inline-flex items-center gap-1.5 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Próxima etapa: <span className="font-semibold">{a.proximo_aprovador.etapa}</span>
                  {a.proximo_aprovador.nome ? <> · <span className="font-semibold">{a.proximo_aprovador.nome}</span></> : null}
                </div>
              )}

              <CadeiaAprovacao etapas={a.etapas} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
