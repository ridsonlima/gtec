'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, Briefcase, ClipboardList, ArrowRightLeft } from 'lucide-react'

interface SearchResults {
  demands:   { id: string; title: string; status: string; priority: string }[]
  reports:   { id: string; title: string; status: string; area: { name: string } }[]
  projects:  { id: string; name: string; status: string; riskLevel: string }[]
  contracts: { id: string; name: string; number: string; status: string }[]
}

type ResultItem = { href: string; label: string; sub?: string; icon: React.ReactNode }

function buildItems(results: SearchResults): { group: string; items: ResultItem[] }[] {
  const groups: { group: string; items: ResultItem[] }[] = []

  if (results.demands.length > 0) {
    groups.push({
      group: 'Demandas',
      items: results.demands.map((d) => ({
        href:  `/demandas/${d.id}`,
        label: d.title,
        sub:   d.priority,
        icon:  <ClipboardList className="w-4 h-4 text-blue-500 flex-shrink-0" />,
      })),
    })
  }
  if (results.projects.length > 0) {
    groups.push({
      group: 'Projetos',
      items: results.projects.map((p) => ({
        href:  `/projetos/${p.id}`,
        label: p.name,
        sub:   p.status,
        icon:  <Briefcase className="w-4 h-4 text-purple-500 flex-shrink-0" />,
      })),
    })
  }
  if (results.reports.length > 0) {
    groups.push({
      group: 'Relatórios',
      items: results.reports.map((r) => ({
        href:  `/reports/${r.id}`,
        label: r.title,
        sub:   r.area.name,
        icon:  <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />,
      })),
    })
  }
  if (results.contracts.length > 0) {
    groups.push({
      group: 'Contratos',
      items: results.contracts.map((c) => ({
        href:  `/contratos/${c.id}`,
        label: c.name,
        sub:   c.number,
        icon:  <ArrowRightLeft className="w-4 h-4 text-amber-500 flex-shrink-0" />,
      })),
    })
  }
  return groups
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const router              = useRouter()
  const inputRef            = useRef<HTMLInputElement>(null)
  const [q, setQ]           = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(-1)

  // Foca input ao abrir
  useEffect(() => {
    if (open) {
      setQ('')
      setResults(null)
      setCursor(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounce de busca
  useEffect(() => {
    if (!open || q.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        setResults(json.data)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, open])

  const groups     = results ? buildItems(results) : []
  const flatItems  = groups.flatMap((g) => g.items)
  const totalItems = flatItems.length

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      onClose()
    },
    [router, onClose],
  )

  // Navegação por teclado
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => (c + 1) % totalItems)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => (c - 1 + totalItems) % totalItems)
      } else if (e.key === 'Enter' && cursor >= 0 && flatItems[cursor]) {
        e.preventDefault()
        navigate(flatItems[cursor].href)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, cursor, flatItems, totalItems, navigate, onClose])

  if (!open) return null

  const empty = results && totalItems === 0

  let flatIdx = 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(-1) }}
            placeholder="Buscar demandas, projetos, relatórios, contratos…"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {q && (
            <button onClick={() => { setQ(''); setResults(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">Esc</kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Buscando…</div>
          )}

          {!loading && q.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {!loading && empty && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Nenhum resultado para <strong>"{q}"</strong>
            </div>
          )}

          {!loading && groups.map((group) => (
            <div key={group.group}>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {group.group}
              </p>
              {group.items.map((item) => {
                const idx     = flatIdx++
                const active  = cursor === idx
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setCursor(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 truncate">{item.label}</span>
                      {item.sub && (
                        <span className="block text-xs text-gray-400 truncate">{item.sub}</span>
                      )}
                    </span>
                    {active && (
                      <kbd className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">↵</kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {totalItems > 0 && (
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 text-xs text-gray-400">
            <span><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navegar</span>
            <span><kbd className="bg-gray-100 px-1 rounded">↵</kbd> abrir</span>
            <span><kbd className="bg-gray-100 px-1 rounded">Esc</kbd> fechar</span>
          </div>
        )}
      </div>
    </div>
  )
}
