import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isManagerOrAbove } from '@/lib/permissions'
import { getApprovoAlerts, getApprovoSummary, getApprovoCredsForUser, APPROVO_LINK } from '@/lib/approvoService'
import { CRITICIDADE_META } from '@/types/approvo'
import { ApprovoDetalhe } from '@/components/approvo/ApprovoDetalhe'
import { ClipboardCheck, Clock, AlertTriangle, DollarSign, ExternalLink, FileText, UserCheck } from 'lucide-react'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default async function AprovacoesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const creds = await getApprovoCredsForUser(session.user.id)
  const [alerts, summary] = await Promise.all([getApprovoAlerts(creds), getApprovoSummary(creds)])
  const naoConfigurado = !creds

  const cards = [
    { label: 'Pendentes', value: String(summary.quantidadePendente), cls: 'text-gray-900', icon: ClipboardCheck, bg: 'bg-blue-50', ic: 'text-blue-600' },
    { label: 'Valor total pendente', value: fmtBRL(summary.valorTotalPendente), cls: 'text-gray-900', icon: DollarSign, bg: 'bg-green-50', ic: 'text-green-600' },
    { label: 'Críticas', value: String(summary.quantidadeCritica), cls: summary.quantidadeCritica > 0 ? 'text-red-600' : 'text-gray-400', icon: AlertTriangle, bg: 'bg-red-50', ic: 'text-red-600' },
    { label: 'Aprovação mais antiga', value: summary.aprovacaoMaisAntiga ? `${summary.aprovacaoMaisAntiga.dias}d` : '—', cls: 'text-gray-900', icon: Clock, bg: 'bg-amber-50', ic: 'text-amber-600', sub: summary.aprovacaoMaisAntiga?.numero },
  ]

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" /> Aprovações Approvo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Documentos pendentes de aprovação na sua alçada. Aja direto no Approvo.</p>
        </div>
        <a
          href={APPROVO_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Abrir Approvo
        </a>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${c.ic}`} />
              </div>
              <p className={`text-lg font-bold ${c.cls}`}>{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
              {c.sub && <p className="text-xs text-gray-400 truncate">{c.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* Lista */}
      {naoConfigurado ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">Approvo não configurado para você</p>
          <p className="text-xs text-gray-400 mt-1">Cadastre os seus próprios códigos do Approvo para ver a sua fila.</p>
          <Link
            href="/minha-conta"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90"
          >
            <UserCheck className="w-4 h-4" /> Configurar meu acesso
          </Link>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-10 text-center">
          <ClipboardCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-800">Nenhuma aprovação pendente 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const meta = CRITICIDADE_META[a.criticidade]
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-gray-400" />{a.tipo_documento}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{a.numero_documento}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
                        {a.criticidade === 'critico' && <AlertTriangle className="w-3 h-3" />}
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{a.descricao}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900 whitespace-nowrap">{fmtBRL(a.valor)}</p>
                    <p className="text-xs text-gray-400">{a.dias_pendente}d pendente</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                  <p className="truncate">Filial: <span className="text-gray-700 font-medium">{a.filial}</span></p>
                  <p className="truncate">Solicitante: <span className="text-gray-700">{a.solicitante || '—'}</span></p>
                  <p className="truncate">Projeto: <span className="text-gray-700">{a.projeto ?? '—'}</span></p>
                  <p className="truncate">Centro de custo: <span className="text-gray-700">{a.centro_custo || '—'}</span></p>
                  <p>Criado em: <span className="text-gray-700">{fmtData(a.data_criacao)}</span></p>
                </div>

                {/* Próxima etapa da alçada */}
                {a.proximo_aprovador && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-xs text-blue-800">
                      Próxima etapa de aprovação: <span className="font-semibold">{a.proximo_aprovador.etapa}</span>
                      {a.proximo_aprovador.nome ? <> · <span className="font-semibold">{a.proximo_aprovador.nome}</span></> : null}
                    </span>
                  </div>
                )}

                {/* Detalhe sob demanda: aprovadores reais + mapa de cotação */}
                <ApprovoDetalhe chaveCompleta={a.chave_completa} />

                {/* Ação */}
                <div className="mt-4 flex justify-end">
                  <a
                    href={a.link_approvo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 w-full sm:w-auto"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir Approvo
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {naoConfigurado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          ⚠️ <strong>Approvo não configurado para o seu usuário.</strong> Para ver a sua fila de aprovações, vá em{' '}
          <Link href="/minha-conta" className="underline font-semibold">Minha conta → Integração Approvo</Link>{' '}
          e cadastre os seus códigos (codUsuario, codPerfil, codUsuarioMega).
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
          ✅ <strong>Sua fila de aprovações do Approvo</strong> — sincronizada em tempo real e visível somente para você.
        </div>
      )}
    </div>
  )
}
