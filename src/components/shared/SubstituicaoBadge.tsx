import { Palmtree, ArrowRightLeft } from 'lucide-react'
import { MOTIVO_AUSENCIA_LABEL, type SubstituicaoInfo } from '@/lib/ausencias'

function fmt(d: Date | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Alerta completo (banner) — para páginas de detalhe.
 * Sinaliza que [pessoa] está ausente e foi substituída temporariamente.
 */
export function SubstituicaoAlert({ nome, info }: { nome: string; info: SubstituicaoInfo }) {
  const motivo = MOTIVO_AUSENCIA_LABEL[info.motivo] ?? 'ausência'
  const ate = fmt(info.dataFim)
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Palmtree className="w-5 h-5 text-amber-600" />
      </div>
      <p className="text-sm text-amber-900">
        <span className="font-semibold">{nome}</span> está em <span className="font-medium">{motivo}</span> e foi
        substituído(a) temporariamente por <span className="font-semibold">{info.substitutoNome}</span>
        {ate ? <> até <span className="font-medium">{ate}</span></> : ' (sem data de retorno)'}.
      </p>
    </div>
  )
}

/**
 * Badge compacto inline — para listas e cards, ao lado do nome da pessoa.
 */
export function SubstituicaoBadge({ info, className = '' }: { info: SubstituicaoInfo; className?: string }) {
  return (
    <span
      title={`Substituído(a) por ${info.substitutoNome}`}
      className={`inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full ${className}`}
    >
      <ArrowRightLeft className="w-3 h-3" />
      coberto por {info.substitutoNome}
    </span>
  )
}
