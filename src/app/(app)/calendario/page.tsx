'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type EventColor = 'red' | 'orange' | 'blue' | 'purple' | 'green'
type EventType  = 'demand' | 'contract' | 'agenda'

interface CalEvent {
  id: string
  type: EventType
  title: string
  subtitle: string
  date: string
  href: string
  color: EventColor
  badge: string | null
  responsible: { id: string; name: string } | null
}

const COLOR_DOT: Record<EventColor, string> = {
  red:    'bg-red-500',
  orange: 'bg-orange-400',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  green:  'bg-green-500',
}
const COLOR_PILL: Record<EventColor, string> = {
  red:    'bg-red-50 text-red-700 border-red-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  green:  'bg-green-50 text-green-700 border-green-200',
}

const TYPE_LABEL: Record<EventType, string> = {
  demand:   'Demanda',
  contract: 'Contrato',
  agenda:   'Reunião',
}

const TYPE_TOGGLE_STYLE: Record<EventType, { on: string; off: string }> = {
  demand:   { on: 'bg-blue-600 text-white border-blue-600',     off: 'bg-white text-gray-600 border-gray-300 hover:border-blue-400' },
  contract: { on: 'bg-purple-600 text-white border-purple-600', off: 'bg-white text-gray-600 border-gray-300 hover:border-purple-400' },
  agenda:   { on: 'bg-green-600 text-white border-green-600',   off: 'bg-white text-gray-600 border-gray-300 hover:border-green-400' },
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const ALL_TYPES: EventType[] = ['demand', 'contract', 'agenda']

export default function CalendarioPage() {
  const today = new Date()
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Filtros
  const [activeTypes, setActiveTypes]         = useState<Set<EventType>>(new Set(ALL_TYPES))
  const [responsibleId, setResponsibleId]     = useState<string>('')

  const from = new Date(year, month, 1).toISOString().slice(0, 10)
  const to   = new Date(year, month + 1, 0).toISOString().slice(0, 10)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn:  () => fetch(`/api/calendar?from=${from}&to=${to}`).then((r) => r.json()),
  })

  const allEvents: CalEvent[] = data?.data ?? []

  // Lista de responsáveis únicos extraída dos eventos
  const responsibles = useMemo(() => {
    const map = new Map<string, string>()
    allEvents.forEach((e) => {
      if (e.responsible) map.set(e.responsible.id, e.responsible.name)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [allEvents])

  // Eventos filtrados (client-side após fetch completo do mês)
  const events = useMemo(() => {
    return allEvents.filter((e) => {
      if (!activeTypes.has(e.type)) return false
      if (responsibleId && e.responsible?.id !== responsibleId) return false
      return true
    })
  }, [allEvents, activeTypes, responsibleId])

  const daysInMonth  = getDaysInMonth(year, month)
  const firstDow     = getFirstDayOfWeek(year, month)
  const monthName    = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
    setSelectedDay(null)
  }

  function toggleType(t: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) { if (next.size > 1) next.delete(t) } // mínimo 1 ativo
      else next.add(t)
      return next
    })
  }

  function eventsForDay(day: number) {
    const d = new Date(year, month, day)
    return events.filter((e) => isSameDay(new Date(e.date), d))
  }

  const selectedEvents = selectedDay ? events.filter((e) => isSameDay(new Date(e.date), selectedDay)) : []

  const weekDays  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const hasFilter = activeTypes.size < 3 || responsibleId !== ''

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendário</h1>
          <p className="text-sm text-gray-500 mt-0.5">Prazos de demandas, contratos e reuniões</p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filtrar:
        </span>

        {/* Toggles de tipo */}
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              activeTypes.has(t) ? TYPE_TOGGLE_STYLE[t].on : TYPE_TOGGLE_STYLE[t].off,
            )}
          >
            <span className={cn('w-2 h-2 rounded-full',
              activeTypes.has(t) ? 'bg-white/80' : t === 'demand' ? COLOR_DOT.blue : t === 'contract' ? COLOR_DOT.purple : COLOR_DOT.green
            )} />
            {TYPE_LABEL[t]}s
          </button>
        ))}

        {/* Separador */}
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Responsável */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Responsável:</label>
          <select
            value={responsibleId}
            onChange={(e) => setResponsibleId(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            {responsibles.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Limpar filtros */}
        {hasFilter && (
          <button
            onClick={() => { setActiveTypes(new Set(ALL_TYPES)); setResponsibleId('') }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 ml-auto"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3">
        {([['red', 'Demanda vencida'], ['blue', 'Demanda'], ['purple', 'Contrato'], ['green', 'Reunião']] as [EventColor, string][]).map(([c, l]) => (
          <span key={c} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[c]}`} />
            {l}
          </span>
        ))}
        {events.length !== allEvents.length && (
          <span className="text-xs text-blue-600 font-medium ml-auto">
            {events.length} de {allEvents.length} eventos
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Navegação */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h2 className="text-sm font-semibold text-gray-800 capitalize">{monthName}</h2>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Grade */}
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {weekDays.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14 bg-gray-50/50 rounded-lg" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day       = i + 1
                const date      = new Date(year, month, day)
                const dayEvents = eventsForDay(day)
                const isToday   = isSameDay(date, today)
                const isSelected = selectedDay && isSameDay(date, selectedDay)

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : date)}
                    className={cn(
                      'h-14 rounded-lg flex flex-col items-center pt-1.5 gap-0.5 transition-all text-xs relative',
                      isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
                    )}
                  >
                    <span className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isSelected ? 'text-white' : isToday ? 'bg-blue-600 text-white' : ''
                    )}>
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                        {dayEvents.slice(0, 3).map((e, idx) => (
                          <span
                            key={idx}
                            className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-white' : COLOR_DOT[e.color as EventColor])}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className={cn('text-[10px]', isSelected ? 'text-white' : 'text-gray-400')}>+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Painel lateral: eventos do dia selecionado */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {selectedDay ? (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Nenhum evento neste dia</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={e.href}
                      className={cn('block border rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow', COLOR_PILL[e.color as EventColor])}
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', COLOR_DOT[e.color as EventColor])} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-medium opacity-70">{TYPE_LABEL[e.type]}</span>
                            {e.badge && <span className="text-xs font-semibold">{e.badge}</span>}
                          </div>
                          <p className="text-xs font-medium leading-snug line-clamp-2">{e.title}</p>
                          <p className="text-xs opacity-70 mt-0.5">{e.subtitle}</p>
                          {e.responsible && (
                            <p className="text-xs opacity-60 mt-0.5">👤 {e.responsible.name}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Calendar className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Clique em um dia para ver os eventos</p>
            </div>
          )}
        </div>
      </div>

      {/* Lista de todos os eventos filtrados do mês */}
      {events.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {new Date(year, month).toLocaleDateString('pt-BR', { month: 'long' })} — {events.length} evento{events.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-1.5">
            {events.map((e) => (
              <Link
                key={e.id + e.date}
                href={e.href}
                className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', COLOR_DOT[e.color as EventColor])} />
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-gray-400 mr-2">
                    {new Date(e.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{e.title}</span>
                  <span className="text-xs text-gray-400 ml-2">{e.subtitle}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.responsible && (
                    <span className="text-xs text-gray-400 hidden sm:block">{e.responsible.name}</span>
                  )}
                  {e.badge && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', COLOR_PILL[e.color as EventColor])}>
                      {e.badge}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && !isLoading && (
        <div className="text-center py-10 text-sm text-gray-400">
          Nenhum evento encontrado com os filtros aplicados.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 justify-center py-8">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          Carregando eventos...
        </div>
      )}
    </div>
  )
}
