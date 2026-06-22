'use client'

import { useQuery } from '@tanstack/react-query'
import { Palmtree, UserCheck, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface AusenciaInfo {
  id: string
  motivo: string
  dataInicio: string
  dataFim: string | null
  substituto: { id: string; name: string }
}

interface CoberturaInfo {
  id: string
  motivo: string
  dataFim: string | null
  usuario: { id: string; name: string }
}

interface MeStatus {
  ausencia:   AusenciaInfo | null
  coberturas: CoberturaInfo[]
}

const MOTIVO_LABEL: Record<string, string> = {
  ferias:         'férias',
  licenca_medica: 'licença médica',
  viagem:         'viagem a trabalho',
  outro:          'ausência',
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function AusenciaBanner() {
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery<MeStatus>({
    queryKey: ['ausencia-me'],
    queryFn:  () => fetch('/api/ausencias?me=true').then((r) => r.json()).then((r) => r.data),
    staleTime: 60_000,
  })

  if (dismissed || !data) return null

  const { ausencia, coberturas } = data
  if (!ausencia && coberturas.length === 0) return null

  return (
    <div className="space-y-1.5 px-4 pt-3 pb-0 max-w-7xl mx-auto">
      {/* Usuário está de férias/ausente */}
      {ausencia && (
        <Banner
          variant="yellow"
          icon={<Palmtree className="w-4 h-4" />}
          onDismiss={() => setDismissed(true)}
        >
          <span>
            Você está de <strong>{MOTIVO_LABEL[ausencia.motivo] ?? ausencia.motivo}</strong>
            {ausencia.dataFim && (
              <> até <strong>{fmtDate(ausencia.dataFim)}</strong></>
            )}.{' '}
            <strong>{ausencia.substituto.name}</strong> está cobrindo suas demandas.
          </span>
        </Banner>
      )}

      {/* Usuário está cobrindo alguém */}
      {coberturas.map((c) => (
        <Banner
          key={c.id}
          variant="blue"
          icon={<UserCheck className="w-4 h-4" />}
          onDismiss={() => setDismissed(true)}
        >
          <span>
            Você está cobrindo <strong>{c.usuario.name}</strong>
            {' '}durante {MOTIVO_LABEL[c.motivo] ?? 'ausência'}
            {c.dataFim && (
              <> até <strong>{fmtDate(c.dataFim)}</strong></>
            )}.{' '}
            As demandas dela aparecem na sua lista com o badge{' '}
            <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-medium">
              🏖️ Cobertura
            </span>
          </span>
        </Banner>
      ))}
    </div>
  )
}

function Banner({
  variant, icon, children, onDismiss,
}: {
  variant: 'yellow' | 'blue'
  icon: React.ReactNode
  children: React.ReactNode
  onDismiss: () => void
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-2.5 rounded-xl border text-sm',
      variant === 'yellow'
        ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
        : 'bg-blue-50 border-blue-200 text-blue-900',
    )}>
      <span className={cn(
        'flex-shrink-0 mt-0.5',
        variant === 'yellow' ? 'text-yellow-600' : 'text-blue-600',
      )}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onDismiss}
        className={cn(
          'flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors',
          variant === 'yellow' ? 'text-yellow-500' : 'text-blue-400',
        )}
        title="Fechar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
