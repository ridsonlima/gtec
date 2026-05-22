import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { FileText, ChevronRight, Handshake, Plus, AlertTriangle } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  gestao_obra: 'Gestão de Obra',
  locacao_maquinas: 'Locação de Máq.',
  nota_debito: 'Nota de Débito',
  outro: 'Outro',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50 border-green-200',
  at_risk: 'text-red-700 bg-red-50 border-red-200',
  delayed: 'text-amber-700 bg-amber-50 border-amber-200',
  suspended: 'text-gray-600 bg-gray-100 border-gray-200',
  completed: 'text-blue-700 bg-blue-50 border-blue-200',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', at_risk: 'Em risco', delayed: 'Atrasado', suspended: 'Suspenso', completed: 'Concluído',
}

export default async function GestaoParceirosContratosPage() {
  const session = await auth()
  if (!session) return null

  const allowedAreaIds = getUserAreaIds(session)
  const canEdit = ['master', 'admin', 'director'].includes(session.user.role)

  const contracts = await prisma.contract.findMany({
    where: {
      executionModality: 'partner',
      ...(allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}),
    },
    include: {
      area: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      contractPartners: {
        include: {
          empresaParceira: true,
          instrumentos: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-sm text-gray-400">
            <Link href="/gestao-parceiros" className="hover:text-gray-600">Gestão de Parceiros</Link>
            <span>/</span>
            <span className="text-gray-600">Contratos</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Contratos de Parceiros
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {contracts.length} contrato{contracts.length !== 1 ? 's' : ''} — selecione para configurar parceiros e acordo de fechamento
          </p>
        </div>
        {canEdit && (
          <Link
            href="/gestao-parceiros/contratos/novo"
            className="inline-flex items-center gap-2 px-3 py-2 bg-cdg-blue text-white text-sm font-medium rounded-lg hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Novo contrato
          </Link>
        )}
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhum contrato com modalidade parceiro cadastrado
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => {
            const semParceiro = c.contractPartners.length === 0
            const semInstrumentos = c.contractPartners.some((cp) => cp.instrumentos.length === 0)

            return (
              <Link
                key={c.id}
                href={`/contratos/${c.id}`}
                className="block bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow group"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{c.number}</span>
                      <span className="text-xs text-gray-400">{c.area.name}</span>
                      {semParceiro && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Sem parceiro
                        </span>
                      )}
                      {!semParceiro && semInstrumentos && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Acordo incompleto
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    {c.responsible && <p className="text-xs text-gray-400 mt-0.5">{c.responsible.name}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 ml-4" />
                </div>

                {c.contractPartners.length > 0 && (
                  <div className="px-5 pb-4 space-y-3 border-t border-gray-50 pt-3">
                    {c.contractPartners.map((cp) => (
                      <div key={cp.id} className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Handshake className="w-3.5 h-3.5 text-blue-400" />
                            <p className="text-sm font-medium text-gray-700">{cp.empresaParceira.name}</p>
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{cp.percentageTotal}%</span>
                          </div>
                          {cp.instrumentos.length === 0 ? (
                            <p className="text-xs text-amber-600 italic ml-5">Nenhum instrumento fiscal configurado</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 ml-5">
                              {cp.instrumentos.map((i) => {
                                const somaFixos = cp.instrumentos
                                  .filter((x) => x.tipo !== 'nota_debito' && x.percentage != null)
                                  .reduce((s, x) => s + (x.percentage ?? 0), 0)
                                const pctEfetivo = i.tipo === 'nota_debito' ? (cp.percentageTotal - somaFixos) : (i.percentage ?? 0)
                                return (
                                  <span key={i.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-0.5 text-gray-600">
                                    {TIPO_LABELS[i.tipo] ?? i.tipo}
                                    <span className="font-semibold text-gray-800 ml-1">{pctEfetivo.toFixed(2)}%</span>
                                    {i.tipo === 'nota_debito' && <span className="text-amber-500 ml-1 italic">residual</span>}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
