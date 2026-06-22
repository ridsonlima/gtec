'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Registra (silenciosamente) que o usuário abriu esta demanda e invalida o cache
 *  das listas (Kanban/Lista/Pipeline) para o destaque de "novidade" sumir ao voltar. */
export function MarkDemandViewed({ demandId }: { demandId: string }) {
  const router = useRouter()
  useEffect(() => {
    fetch(`/api/demands/${demandId}/view`, { method: 'POST' })
      .then(() => { router.refresh() })
      .catch(() => {})
  }, [demandId, router])
  return null
}
