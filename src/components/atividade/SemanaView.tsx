'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw,
  ClipboardList, FileText, CalendarDays, CheckSquare, RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isSameDay, format, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EventColor = 'red' | 'orange' | 'blue' | 'purple' | 'green' | 'amber'

interface WeekEvent {
  id: string
  type: 'demand' | 'contract' | 'agenda' | 'tarefa' | 'tarefa_recorrente'
  title: string
  subtitle: string
  date: string          // ISO date for pinned events
  weekday?: number      // 0=Dom..6=Sáb, for recurring tasks
  href: string
  color: EventColor
  badge?: string
  recorrencia?: string  // "diaria"|"semanal"|"quinzenal"|"mensal"
}

interface TarefaPessoal {
  id: string
  titulo: string
  descricao?: string
  status: string
  prioridade: string
  categoria?: string
  prazo?: string
  recorrente: boolean
  recorrencia?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_BG: Record<EventColor, string> = {
  red:    'bg-red-50 border-red-200 text-red-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-800',
  blue:   'bg-blue-50 border-blue-200 text-blue-800',
  purple: 'bg-purple-50 border-purple-200 text-purple-800',
  green:  'bg-green-50 border-green-200 text-green-800',
  amber:  'bg-amber-50 border-amber-200 text-amber-800',
}

const COLOR_DOT: Record<EventColor, string> = {
  red:    'bg-red-500',
  orange: 'bg-orange-400',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  green:  'bg-green-500',
  amber:  'bg-amber-400',
}

const RECORRENCIA_LABEL: Record<string, string> = {
  diaria:     'diária',
  semanal:    'semanal',
  quinzenal:  'quinzenal',
  mensal:     'mensal',
}

function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 }) // segunda-feira
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

function shouldShowRecurringToday(tarefa: TarefaPessoal, day: Date): boolean {
  if (!tarefa.recorrente || !tarefa.recorrencia || tarefa.status === 'concluida' || tarefa.status === 'cancelada') return false
  if (!tarefa.prazo) return false

  const origin = new Date(tarefa.prazo)
  const now    = day

  if (origin > now) return false

  switch (tarefa.recorrencia) {
    case 'diaria':
      return true
    case 'semanal':
      return getDay(origin) === getDay(now)
    case 'quinzenal': {
      const diffDays = Math.floor((now.getTime() - origin.getTime()) / 86400000)
      return diffDays % 14 === 0
    }
    case 'mensal':
      return origin.getDate() === now.getDate()
    default:
      return false
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SemanaView() {
  const today     = new Date()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekDays  = getWeekDays(weekStart)

  const fromISO = weekStart.toISOString().slice(0, 10)
  const toISO   = weekEnd.toISOString().slice(0, 10)

  const { data: calData, isLoading: calLoading } = useQuery({
    queryKey: ['calendar-week', fromISO],
    queryFn:  () => fetch(`/api/calendar?from=${fromISO}&to=${toISO}`).then((r) => r.json()),
  })

  const { data: tarefasData, isLoading: tarefasLoading } = useQuery({
    queryKey: ['tarefas-pessoais'],
    queryFn:  () => fetch('/api/tarefas-pessoais').then((r) => r.json()),
  })

  const calEvents: WeekEvent[] = useMemo(() => {
    const raw = calData?.data ?? []
    return raw.map((e: any) => ({
      id:       e.id,
      type:     e.type,
      title:    e.title,
      subtitle: e.subtitle,
      date:     e.date,
      href:     e.href,
      color:    e.color as EventColor,
      badge:    e.badge ?? undefined,
    }))
  }, [calData])

  const tarefas: TarefaPessoal[] = tarefasData?.data ?? []

  // Tarefas com prazo fixo nessa semana
  const tarefasSemana: WeekEvent[] = useMemo(() => {
    return tarefas
      .filter((t) => {
        if (!t.prazo || t.recorrente) return false
        const d = new Date(t.prazo)
        return d >= weekStart && d <= weekEnd && t.status !== 'cancelada'
      })
      .map((t) => ({
        id:       t.id,
        type:     'tarefa' as const,
        title:    t.titulo,
        subtitle: t.categoria ?? 'Tarefa pessoal',
        date:     t.prazo!,
        href:     '/minhas-tarefas',
        color:    t.status === 'concluida' ? 'green' :
                  t.prioridade === 'urgente' ? 'red' :
                  t.prioridade === 'alta'    ? 'orange' : 'amber',
        badge:    t.status === 'concluida' ? 'Concluída' : undefined,
      }))
  }, [tarefas, weekStart, weekEnd])

  // Tarefas recorrentes que se aplicam a algum dia desta semana
  const tarefasRecorrentes: WeekEvent[] = useMemo(() => {
    const result: WeekEvent[] = []
    for (const t of tarefas) {
      if (!t.recorrente) continue
      for (const day of weekDays) {
        if (shouldShowRecurringToday(t, day)) {
          result.push({
            id:          `${t.id}-${day.toISOString().slice(0, 10)}`,
            type:        'tarefa_recorrente',
            title:       t.titulo,
            subtitle:    RECORRENCIA_LABEL[t.recorrencia ?? ''] ?? 'Recorrente',
            date:        day.toISOString(),
            href:        '/minhas-tarefas',
            color:       'amber',
            badge:       '↻',
            recorrencia: t.recorrencia,
          })
        }
      }
    }
    return result
  }, [tarefas, weekDays])

  const allEvents = [...calEvents, ...tarefasSemana, ...tarefasRecorrentes]

  function eventsForDay(day: Date): WeekEvent[] {
    return allEvents.filter((e) => isSameDay(new Date(e.date), day))
  }

  const totalThisWeek = allEvents.length
  const isLoading     = calLoading || tarefasLoading
  const isCurrentWeek = isSameDay(weekStart, getWeekStart(today))

  const typeIcon = (type: string) => {
    switch (type) {
      case 'demand':           return <ClipboardList className="w-3 h-3 flex-shrink-0" />
      case 'contract':         return <FileText className="w-3 h-3 flex-shrink-0" />
      case 'agenda':           return <CalendarDays className="w-3 h-3 flex-shrink-0" />
      case 'tarefa':           return <CheckSquare className="w-3 h-3 flex-shrink-0" />
      case 'tarefa_recorrente':return <RotateCcw className="w-3 h-3 flex-shrink-0" />
      default:                 return null
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Cabeçalho da semana ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(s => getWeekStart(subWeeks(s, 1)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>

          <div className="text-sm font-semibold text-gray-800 px-1 min-w-[200px] text-center">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })}
            {' – '}
            {format(weekEnd, "d 'de' MMM, yyyy", { locale: ptBR })}
          </div>

          <button
            onClick={() => setWeekStart(s => getWeekStart(addWeeks(s, 1)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>

          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(getWeekStart(today))}
              className="ml-1 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Hoje
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {isLoading ? 'Carregando…' : `${totalThisWeek} atividade${totalThisWeek !== 1 ? 's' : ''} esta semana`}
          </span>

          {/* Legenda */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
            {([
              ['blue',   'Demanda'],
              ['purple', 'Contrato'],
              ['green',  'Reunião'],
              ['amber',  'Tarefa'],
            ] as [EventColor, string][]).map(([c, l]) => (
              <span key={c} className="flex items-center gap-1">
                <span className={cn('w-2 h-2 rounded-full', COLOR_DOT[c])} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grade semanal ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 justify-center py-16">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          Carregando semana…
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayEvents = eventsForDay(day)
            const isToday   = isSameDay(day, today)
            const isPast    = day < today && !isToday
            const dayName   = format(day, 'EEE', { locale: ptBR })
            const dayNum    = format(day, 'd')

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'rounded-xl border flex flex-col min-h-[220px]',
                  isToday  ? 'border-blue-300 bg-blue-50/40' :
                  isPast   ? 'border-gray-100 bg-gray-50/30' :
                             'border-gray-200 bg-white',
                )}
              >
                {/* Header do dia */}
                <div className={cn(
                  'px-2 py-2 flex flex-col items-center border-b',
                  isToday ? 'border-blue-200' : 'border-gray-100',
                )}>
                  <span className={cn(
                    'text-[11px] font-medium uppercase tracking-wide',
                    isToday ? 'text-blue-600' : 'text-gray-400',
                  )}>
                    {dayName}
                  </span>
                  <span className={cn(
                    'text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full',
                    isToday ? 'bg-blue-600 text-white' : isPast ? 'text-gray-400' : 'text-gray-800',
                  )}>
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className={cn(
                      'text-[10px] font-medium mt-0.5',
                      isToday ? 'text-blue-600' : 'text-gray-400',
                    )}>
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Eventos do dia */}
                <div className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-[280px]">
                  {dayEvents.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-[10px] text-gray-300">—</span>
                    </div>
                  ) : (
                    dayEvents.map((e) => (
                      <Link
                        key={e.id}
                        href={e.href}
                        className={cn(
                          'block rounded-lg border px-2 py-1.5 text-[11px] leading-snug transition-shadow hover:shadow-sm',
                          COLOR_BG[e.color],
                        )}
                        title={e.title}
                      >
                        <div className="flex items-start gap-1">
                          {typeIcon(e.type)}
                          <span className="font-medium line-clamp-2 flex-1">{e.title}</span>
                          {e.badge && (
                            <span className="ml-1 flex-shrink-0 font-bold">{e.badge}</span>
                          )}
                        </div>
                        <p className="opacity-60 mt-0.5 truncate">{e.subtitle}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Resumo por tipo ────────────────────────────────────────────── */}
      {!isLoading && totalThisWeek > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {(
            [
              ['demand',           'blue',   'Demandas'],
              ['contract',         'purple', 'Contratos'],
              ['agenda',           'green',  'Reuniões'],
              ['tarefa',           'amber',  'Tarefas'],
              ['tarefa_recorrente','amber',  'Recorrentes'],
            ] as [string, EventColor, string][]
          ).map(([type, color, label]) => {
            const count = allEvents.filter((e) => e.type === type).length
            if (count === 0) return null
            return (
              <div key={type} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium', COLOR_BG[color])}>
                <span className={cn('w-2 h-2 rounded-full', COLOR_DOT[color])} />
                {count} {label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
