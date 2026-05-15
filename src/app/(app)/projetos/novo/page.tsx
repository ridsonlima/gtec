'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

type UserOption = { id: string; name: string }

export default function NovoProjetoPage() {
  const router = useRouter()

  const [name,            setName]            = useState('')
  const [objective,       setObjective]       = useState('')
  const [status,          setStatus]          = useState('planned')
  const [riskLevel,       setRiskLevel]       = useState('low')
  const [startDate,       setStartDate]       = useState('')
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [responsibleId,   setResponsibleId]   = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [userSearch,      setUserSearch]      = useState('')
  const [userOptions,     setUserOptions]     = useState<UserOption[]>([])
  const [showDropdown,    setShowDropdown]    = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (userSearch.length < 2) { setUserOptions([]); return }
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`)
      if (res.ok) { const d = await res.json(); setUserOptions(d.data ?? []) }
    }, 200)
    return () => clearTimeout(t)
  }, [userSearch])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Nome é obrigatório')
    if (!responsibleId) return setError('Selecione o responsável')
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          objective: objective.trim() || null,
          responsibleId,
          status,
          riskLevel,
          startDate:       startDate || null,
          expectedEndDate: expectedEndDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao criar projeto')
      router.push(`/projetos/${data.data.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/projetos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        <ChevronLeft className="w-4 h-4" />
        Projetos
      </Link>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Novo Projeto</h1>
        <p className="text-sm text-gray-500 mt-0.5">Defina as informações básicas do projeto</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do Projeto *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Reforma da Estação Norte"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Objetivo / Descrição</label>
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            placeholder="Descreva o objetivo do projeto…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Responsável */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsável *</label>
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              value={responsibleId ? responsibleName : userSearch}
              onChange={(e) => {
                if (responsibleId) { setResponsibleId(''); setResponsibleName('') }
                setUserSearch(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar por nome…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showDropdown && userOptions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {userOptions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setResponsibleId(u.id); setResponsibleName(u.name); setUserSearch(''); setShowDropdown(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="planned">Planejado</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nível de Risco</label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Baixo</option>
              <option value="medium">Médio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Previsão de Entrega</label>
            <input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Link href="/projetos" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Criando…' : 'Criar Projeto'}
          </button>
        </div>
      </form>
    </div>
  )
}
