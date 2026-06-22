'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { markDemandSeenInCache } from '@/lib/demandCache'

/** Registra (silenciosamente) que o usuário abriu esta demanda e limpa o destaque
 *  de "novidade" nas listas ao voltar.
 *
 *  Antes só fazia router.refresh() — que atualiza Server Components (Kanban), mas
 *  NÃO o cache do react-query (Pipeline/Lista, staleTime 30s). Por isso o "amarelo"
 *  grudava ao voltar. Agora também atualiza/invalida as queries client-side. */
export function MarkDemandViewed({ demandId }: { demandId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  useEffect(() => {
    fetch(`/api/demands/${demandId}/view`, { method: 'POST' })
      .then(() => {
        markDemandSeenInCache(qc, demandId)
        qc.invalidateQueries({ queryKey: ['pipeline-demands'] })
        qc.invalidateQueries({ queryKey: ['demands'] })
        router.refresh()
      })
      .catch(() => {})
  }, [demandId, router, qc])
  return null
}
