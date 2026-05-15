'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, X } from 'lucide-react'

type Collaborator = { id: string; name: string; role: string }
type PanelRole = 'contributor' | 'observer'

interface Props {
  demandId: string
  collaborators: Collaborator[]
  canManage: boolean
  currentUserId: string
}

const ROLE_LABELS: Record<PanelRole, string> = {
  contributor: 'Contribuidor',
  observer: 'Observador',
}

export function CollaboratorsPanel({ demandId, collaborators: initial, canManage, currentUserId }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedRole, setSelectedRole] = useState<PanelRole>('contributor')
  const ref = useRef<HTMLDivElement>(null)

  const { data: searchData } = useQuery({
    queryKey: ['users-search-collab', search],
    queryFn: () => fetch(`/api/users/search?q=${encodeURIComponent(search)}`).then((r) => r.json()),
    enabled: search.length >= 2,
  })

  const results: Collaborator[] = searchData?.data ?? []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const addMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: PanelRole }) => {
      const res = await fetch(`/api/demands/${demandId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      if (!res.ok) throw new Error('Erro ao adicionar colaborador')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demand', demandId] })
      setSearch('')
      setShowDropdown(false)
      // Recarrega a página para refletir o novo colaborador (Server Component)
      window.location.reload()
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/demands/${demandId}/collaborators?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover colaborador')
      return res.json()
    },
    onSuccess: () => {
      window.location.reload()
    },
  })

  if (!canManage && initial.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Colaboradores ({initial.length})
        </h3>
      </div>

      {initial.length === 0 && (
        <p className="text-sm text-gray-400 mb-3">Nenhum colaborador adicionado.</p>
      )}

      {initial.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {initial.map((c) => (
            <div
              key={c.id}
              className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-2 py-1"
            >
              <span className="text-xs font-medium text-gray-700">{c.name}</span>
              <span className="text-xs text-gray-400">· {ROLE_LABELS[c.role as PanelRole] ?? c.role}</span>
              {canManage && (
                <button
                  onClick={() => removeMutation.mutate(c.id)}
                  disabled={removeMutation.isPending}
                  className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div ref={ref} className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Adicionar colaborador..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as PanelRole)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="contributor">Contribuidor</option>
              <option value="observer">Observador</option>
            </select>
          </div>

          {showDropdown && results.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {results
                .filter((u) => !initial.find((c) => c.id === u.id))
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                    onMouseDown={() => addMutation.mutate({ userId: u.id, role: selectedRole })}
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-gray-400">({u.role})</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
