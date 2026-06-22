import type { QueryClient } from '@tanstack/react-query'

/**
 * Marca uma demanda como "vista" otimisticamente em todos os caches de lista
 * (pipeline, lista) para o selo "Novo" sumir imediatamente, sem esperar refetch.
 * Use junto com o POST /api/demands/[id]/view.
 */
export function markDemandSeenInCache(qc: QueryClient, demandId: string) {
  for (const queryKey of [['pipeline-demands'], ['demands']]) {
    qc.setQueriesData({ queryKey }, (old: any) => {
      if (!old?.data || !Array.isArray(old.data)) return old
      return {
        ...old,
        data: old.data.map((d: any) =>
          d.id === demandId ? { ...d, unread: false } : d
        ),
      }
    })
  }
}
