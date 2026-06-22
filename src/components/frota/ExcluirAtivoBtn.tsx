'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'

type Counts = {
  alocacoes: number
  ordensServico: number
  medicaoItens: number
  auditoriaItens: number
}

export function ExcluirAtivoBtn({ ativoId, ativoTag }: { ativoId: string; ativoTag: string }) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [counts, setCounts]   = useState<Counts | null>(null)
  const [error, setError]     = useState('')

  async function handleOpen() {
    setError('')
    setCounts(null)
    setLoading(true)
    setOpen(true)
    // Verifica vínculos antes de mostrar modal
    const res  = await fetch(`/api/frota/ativos/${ativoId}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)
    if (data.data?.requiresForce) {
      setCounts(data.data.counts)
    } else if (data.data?.deleted) {
      router.push('/frota/ativos')
      router.refresh()
    } else {
      setError(data.error ?? 'Erro ao verificar registros')
    }
  }

  async function handleConfirm(force: boolean) {
    setLoading(true)
    setError('')
    const url = `/api/frota/ativos/${ativoId}${force ? '?force=true' : ''}`
    const res  = await fetch(url, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)
    if (data.data?.deleted) {
      setOpen(false)
      router.push('/frota/ativos')
      router.refresh()
    } else {
      setError(data.error ?? 'Erro ao excluir')
    }
  }

  const totalVinculos = counts
    ? counts.alocacoes + counts.ordensServico + counts.medicaoItens + counts.auditoriaItens
    : 0

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Excluir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Excluir ativo {ativoTag}?</h2>
                <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            )}

            {!loading && counts && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-amber-800">
                  Este ativo possui {totalVinculos} registro{totalVinculos !== 1 ? 's' : ''} vinculado{totalVinculos !== 1 ? 's' : ''}:
                </p>
                <ul className="text-sm text-amber-700 space-y-0.5 pl-3">
                  {counts.alocacoes > 0     && <li>• {counts.alocacoes} alocaç{counts.alocacoes !== 1 ? 'ões' : 'ão'}</li>}
                  {counts.ordensServico > 0 && <li>• {counts.ordensServico} ordem{counts.ordensServico !== 1 ? 'ns' : ''} de serviço</li>}
                  {counts.medicaoItens > 0  && <li>• {counts.medicaoItens} item{counts.medicaoItens !== 1 ? 'ns' : ''} de medição</li>}
                  {counts.auditoriaItens > 0 && <li>• {counts.auditoriaItens} item{counts.auditoriaItens !== 1 ? 'ns' : ''} de auditoria</li>}
                </ul>
                <p className="text-xs text-amber-600 pt-1">
                  Todos serão removidos permanentemente junto com o ativo.
                </p>
              </div>
            )}

            {!loading && !counts && !error && (
              <p className="text-sm text-gray-600">
                O ativo <span className="font-semibold">{ativoTag}</span> será excluído permanentemente do sistema.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
            )}

            {!loading && !error && (
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleConfirm(!!counts)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  {counts ? 'Excluir tudo' : 'Confirmar exclusão'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
