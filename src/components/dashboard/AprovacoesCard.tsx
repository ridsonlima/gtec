import Link from 'next/link'
import { getApprovoSummary, getApprovoCredsForUser, APPROVO_LINK } from '@/lib/approvoService'
import { ClipboardCheck, ExternalLink, ArrowRight } from 'lucide-react'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** Card de Aprovações Pendentes para o Dashboard (fila do próprio usuário). */
export async function AprovacoesCard({ userId }: { userId: string }) {
  const creds = await getApprovoCredsForUser(userId)
  if (!creds) return null  // usuário sem Approvo configurado → não mostra o card
  const summary = await getApprovoSummary(creds)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">Aprovações Pendentes</h2>
        {summary.quantidadeCritica > 0 && (
          <span className="ml-auto text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            {summary.quantidadeCritica} crítica{summary.quantidadeCritica > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-50">
        <Mini label="Pendentes" value={String(summary.quantidadePendente)} cls="text-gray-900" />
        <Mini label="Valor total" value={fmtBRL(summary.valorTotalPendente)} cls="text-green-600" />
        <Mini label="Críticas" value={String(summary.quantidadeCritica)} cls={summary.quantidadeCritica > 0 ? 'text-red-600' : 'text-gray-400'} />
        <Mini label="Mais antiga" value={summary.aprovacaoMaisAntiga ? `${summary.aprovacaoMaisAntiga.dias}d` : '—'} cls="text-amber-600" />
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
        <Link href="/aprovacoes" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50">
          Ver detalhes <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <a href={APPROVO_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <ExternalLink className="w-3.5 h-3.5" /> Abrir Approvo
        </a>
      </div>
    </div>
  )
}

function Mini({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className={`text-base font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
