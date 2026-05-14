'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type EventColor = 'red' | 'orange' | 'blue' | 'purple' | 'green'

interface CalEvent {
  id: string
  type: 'demand' | 'contract' | 'agenda'
  title: string
  subtitle: string
  date: string
  href: string
  color: EventColor
  badge: string | null
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

const TYPE_ICON: Record<string, string> = {
  demand:   'Demanda',
  contract: 'Contrato',
  agenda:   'Reunião',
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday=0
}

export default function CalendarioPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const from = new Date(year, month, 1).toISOString().slice(0, 10)
  const to   = new Date(year, month + 1, 0).toISOString().slice(0, 10)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => fetch(`/api/calendar?from=${from}&to=${to}`).then((r) => r.json()),
  })

  const events: CalEvent[] = data?.data ?? []

  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)

  const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
    setSelectedDay(null)
  }

  function eventsForDay(day: number) {
    const d = new Date(year, month, day)
    return events.filter((e) => isSameDay(new Date(e.date), d))
  }

  const selectedEvents = selectedDay ? events.filter((e) => isSameDay(new Date(e.date), selectedDay)) : []

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Calendário</h1>
        <p className="text-sm text-gray-500 mt-0.5">Prazos de demandas, contratos e reuniões</p>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3">
        {([['red', 'Demanda vencida'], ['blue', 'Demanda'], ['purple', 'Contrato'], ['green', 'Reunião']] as [EventColor, string][]).map(([c, l]) => (
          <span key={c} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[c]}`} />
            {l}
          </span>
        ))}
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
            {/* Dias da semana */}
            <div className="grid grid-cols-7 mb-1">
              {weekDays.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Células */}
            <div className="grid grid-cols-7 gap-px">
              {/* Espaços em branco antes do dia 1 */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14 bg-gray-50/50 rounded-lg" />
              ))}

              {/* Dias do mês */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const date = new Date(year, month, day)
                const dayEvents = eventsForDay(day)
                const isToday = isSameDay(date, today)
                const isSelected = selectedDay && isSameDay(date, selectedDay)
                const hasOverdue = dayEvents.some((e) => e.color === 'red')

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
                            <span className="text-xs font-medium opacity-70">{TYPE_ICON[e.type]}</span>
                            {e.badge && <span className="text-xs font-semibold">{e.badge}</span>}
                          </div>
                          <p className="text-xs font-medium leading-snug line-clamp-2">{e.title}</p>
                          <p className="text-xs opacity-70 mt-0.5">{e.subtitle}</p>
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

      {/* Lista de todos os eventos do mês */}
      {events.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Todos os eventos de {new Date(year, month).toLocaleDateString('pt-BR', { month: 'long' })} ({events.length})
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
                {e.badge && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0', COLOR_PILL[e.color as EventColor])}>
                    {e.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
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
