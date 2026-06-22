'use client'

import { useQuery } from '@tanstack/react-query'
import { GerenciarDadosSeguranca } from './GerenciarDados'

/* ─── Fallback enquanto não há config sincronizada ─── */
const FALLBACK = {
  diasSemAcidentes: 0,
  treinamentosConforme: 0,
  treinamentosNecessitam: 0,
  totalCustos: 0,
  inspecaoSeguranca: 0,
  dssRealizados: 0,
  mesReferencia: '—',
  syncedAt: null as string | null,
}

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

type DadosMes = { mes: string; valor: number }

/* ─── helpers SVG ─────────────────────────────────────── */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function piePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg)
  const e = polar(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`
}

/* ─── Gráfico de pizza ─────────────────────────────────── */
function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="text-xs text-gray-400 text-center">Sem dados</div>

  let current = 0
  const paths = slices.map((s) => {
    const pct = s.value / total
    const start = current * 360
    const end   = (current + pct) * 360
    current += pct
    return { ...s, path: piePath(50, 50, 44, start, end), pct }
  })

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="w-20 h-20 flex-shrink-0">
        {paths.map((p) => (
          <path key={p.label} d={p.path} fill={p.color} />
        ))}
      </svg>
      <div className="space-y-1">
        {paths.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-700 font-medium">{p.label}</span>
            <span className="text-gray-500 ml-0.5">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Gráfico de donut ─────────────────────────────────── */
function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="text-xs text-gray-400 text-center">Sem dados</div>

  const R = 40, cx = 50, cy = 50
  const circ = 2 * Math.PI * R
  let offset = circ * 0.25

  const arcs = slices.map((s) => {
    const dash = (s.value / total) * circ
    const arc = { ...s, dash, offset, pct: Math.round((s.value / total) * 100) }
    offset += dash
    if (offset > circ) offset -= circ
    return arc
  })

  const dominant = arcs.reduce((a, b) => (a.value > b.value ? a : b))

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-20 h-20">
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="18"
              strokeDasharray={`${a.dash} ${circ - a.dash}`}
              strokeDashoffset={-a.offset + circ * 0.25}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: dominant.color }}>{dominant.pct}%</span>
        </div>
      </div>
      <div className="space-y-1">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: a.color }} />
            <span className="text-gray-700 font-medium">{a.label}</span>
            <span className="text-gray-500">{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Gráfico de barras verticais ──────────────────────── */
function BarChart({ data, color = '#d97706' }: { data: DadosMes[]; color?: string }) {
  if (!data.length) return <div className="text-xs text-gray-400 text-center">Sem dados</div>

  const max = Math.max(...data.map((d) => d.valor), 1)
  const avg = data.reduce((s, d) => s + d.valor, 0) / data.length

  return (
    <div className="w-full">
      {/* Trilha das barras (altura fixa para o % refletir) */}
      <div className="flex items-end gap-2 h-24 relative">
        {/* Linha de média tracejada */}
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-red-500 pointer-events-none z-10"
          style={{ bottom: `${(avg / max) * 100}%` }}
        />
        {data.map((d) => {
          const h = d.valor > 0 ? Math.max((d.valor / max) * 100, 4) : 0
          return (
            <div key={d.mes} className="flex-1 h-full flex flex-col items-center justify-end">
              <span className="text-[10px] font-semibold text-gray-700 leading-none mb-0.5">
                {d.valor.toFixed(1)}
              </span>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${h}%`, backgroundColor: color }}
              />
            </div>
          )
        })}
      </div>
      {/* Rótulos dos meses */}
      <div className="flex gap-2 mt-1">
        {data.map((d) => (
          <span key={d.mes} className="flex-1 text-center text-[10px] text-gray-500 font-medium">{d.mes}</span>
        ))}
      </div>
    </div>
  )
}

/* ─── Barras horizontais por mês ───────────────────────── */
function HorizontalBars({ porMes }: { porMes: Record<string, number> }) {
  const mesesComDados = MESES.filter((m) => m in porMes)
  const max = Math.max(...Object.values(porMes), 1)

  return (
    <div className="space-y-2 w-full">
      {mesesComDados.map((mes) => {
        const v = porMes[mes] ?? 0
        return (
          <div key={mes} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-7 text-right lowercase">{mes.toLowerCase()}</span>
            <div className="flex-1 bg-gray-100 rounded-sm h-5 overflow-hidden">
              <div
                className="h-full rounded-sm bg-gray-800 flex items-center justify-end pr-1 transition-all"
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-800 w-4">{v}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Diagrama corporal de lesões ──────────────────────── */
function BodyDiagram({ lesoes }: { lesoes: { nome: string; pct: number }[] }) {
  const map: Record<string, { cx: number; cy: number; side: 'left' | 'right' }> = {
    'Cabeça/Face':    { cx: 60, cy: 18,  side: 'right' },
    'Coluna/Tronco':  { cx: 60, cy: 68,  side: 'right' },
    'Braço/Cotovelo': { cx: 28, cy: 82,  side: 'left'  },
    'Mãos/Dedos':     { cx: 96, cy: 105, side: 'right' },
    'Joelho/Perna':   { cx: 44, cy: 160, side: 'left'  },
    'Pé/Tornozelo':   { cx: 56, cy: 208, side: 'right' },
  }

  return (
    <div className="flex items-center justify-center w-full">
      <svg viewBox="0 0 200 230" className="w-full max-w-[180px]">
        {/* ── Silhueta corporal ── */}
        {/* Cabeça */}
        <ellipse cx="65" cy="18" rx="14" ry="16" fill="#f5c89a" stroke="#b87333" strokeWidth="1" />
        {/* Pescoço */}
        <rect x="59" y="32" width="12" height="10" rx="2" fill="#f5c89a" stroke="#b87333" strokeWidth="0.8" />
        {/* Tronco */}
        <rect x="42" y="42" width="46" height="58" rx="6" fill="#f5c89a" stroke="#b87333" strokeWidth="1" />
        {/* Braço esquerdo */}
        <rect x="22" y="44" width="14" height="52" rx="6" fill="#f5c89a" stroke="#b87333" strokeWidth="1" />
        {/* Mão esquerda */}
        <ellipse cx="29" cy="102" rx="7" ry="9" fill="#f5c89a" stroke="#b87333" strokeWidth="0.8" />
        {/* Braço direito */}
        <rect x="94" y="44" width="14" height="52" rx="6" fill="#f5c89a" stroke="#b87333" strokeWidth="1" />
        {/* Mão direita */}
        <ellipse cx="101" cy="102" rx="7" ry="9" fill="#f5c89a" stroke="#b87333" strokeWidth="0.8" />
        {/* Perna esquerda */}
        <rect x="44" y="100" width="20" height="88" rx="6" fill="#f5c89a" stroke="#b87333" strokeWidth="1" />
        {/* Perna direita */}
        <rect x="66" y="100" width="20" height="88" rx="6" fill="#f5c89a" stroke="#b87333" strokeWidth="1" />
        {/* Pé esquerdo */}
        <ellipse cx="54" cy="194" rx="11" ry="7" fill="#f5c89a" stroke="#b87333" strokeWidth="0.8" />
        {/* Pé direito */}
        <ellipse cx="76" cy="194" rx="11" ry="7" fill="#f5c89a" stroke="#b87333" strokeWidth="0.8" />

        {/* ── Marcadores de lesão ── */}
        {lesoes.map((l) => {
          const pos = map[l.nome]
          if (!pos) return null
          const labelX = pos.side === 'right' ? pos.cx + 18 : pos.cx - 18
          const anchor = pos.side === 'right' ? 'start' : 'end'
          return (
            <g key={l.nome}>
              <line
                x1={pos.cx} y1={pos.cy}
                x2={labelX + (pos.side === 'right' ? 0 : 0)} y2={pos.cy}
                stroke="#cc0000" strokeWidth="0.8" strokeDasharray="2,1"
              />
              <circle cx={pos.cx} cy={pos.cy} r="6" fill="#cc0000" opacity="0.85" />
              <text
                x={labelX} y={pos.cy + 4}
                fontSize="7.5" fill="#111" textAnchor={anchor} fontWeight="500"
              >
                {l.pct.toFixed(2)}%
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legenda textual */}
      <div className="space-y-1 ml-2 flex-shrink-0">
        {lesoes.map((l) => (
          <div key={l.nome} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
            <span className="text-gray-700 whitespace-nowrap">{l.nome}</span>
            <span className="font-bold text-gray-900">{l.pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Card wrapper ─────────────────────────────────────── */
function Card({ title, children, className = '' }: {
  title?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`border border-gray-300 rounded p-3 bg-white flex flex-col gap-2 ${className}`}>
      {title && (
        <p className="text-[10px] font-bold text-center text-gray-600 uppercase tracking-wide leading-tight">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

/* ─── Dashboard principal ──────────────────────────────── */
export function DashboardSeguranca({ canManage = false }: { canManage?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['seguranca-dashboard'],
    queryFn: () => fetch('/api/seguranca/dashboard').then((r) => r.json()),
    staleTime: 2 * 60 * 1000,
  })

  const d = data?.data

  if (isLoading || !d) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const cfg = d.config ?? FALLBACK
  const totalTrein = cfg.treinamentosConforme + cfg.treinamentosNecessitam
  const pct = {
    conforme:   totalTrein > 0 ? Math.round((cfg.treinamentosConforme   / totalTrein) * 10000) / 100 : 0,
    necessitam: totalTrein > 0 ? Math.round((cfg.treinamentosNecessitam / totalTrein) * 10000) / 100 : 0,
  }
  const custosFmt = cfg.totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const turnoSlices = Object.entries(d.porTurno as Record<string, number>).map(([label, value]) => ({
    label,
    value: value as number,
    color: label === 'Manhã' ? '#f6c90e' : label === 'Tarde' ? '#e06b20' : '#6b7280',
  }))

  const sitSlices = Object.entries(d.porSituacao as Record<string, number>).map(([label, value]) => ({
    label: label === 'Investigado' ? 'Concluída' : 'Pendente',
    value: value as number,
    color: label === 'Investigado' ? '#16a34a' : '#dc2626',
  }))

  return (
    <div className="rounded-xl overflow-hidden border border-gray-300 shadow-sm">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-[#0f1e3d] px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-wide uppercase">
            Dashboard de Segurança – CDG 2026
          </h2>
          {cfg.syncedAt && (
            <p className="text-xs text-blue-300 mt-0.5">
              Última sync: {new Date(cfg.syncedAt).toLocaleString('pt-BR')}
            </p>
          )}
          {!d.config && (
            <p className="text-xs text-yellow-300 mt-0.5">
              ⚠ Aguardando primeira sincronização com a planilha
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {canManage && <GerenciarDadosSeguranca />}
          <div className="w-12 h-12 rounded-full bg-green-600 border-4 border-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
              <path d="M12 2L4 7v5c0 5.25 3.4 10.15 8 11.35C16.6 22.15 20 17.25 20 12V7L12 2zm-1 13l-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────── */}
      <div className="bg-gray-50 p-3">

        {/* ── Linha 1: KPIs + charts ────────────────────────── */}
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 1.8fr' }}>

          {/* Total acidentes */}
          <Card title="Total de Acidentes e Incidentes">
            <div className="text-center">
              <span className="text-5xl font-black text-gray-900">{d.total}</span>
            </div>
          </Card>

          {/* Dias sem acidentes */}
          <Card>
            <div className="text-center space-y-0.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Estamos há</p>
              <span className="text-5xl font-black text-gray-900">{cfg.diasSemAcidentes}</span>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Dias sem acidentes</p>
            </div>
          </Card>

          {/* Ocorrências por turno */}
          <Card title="Ocorrências por Turnos">
            <PieChart slices={turnoSlices} />
          </Card>

          {/* Situação da investigação */}
          <Card title="Situação da Investigação">
            <DonutChart slices={sitSlices} />
          </Card>

          {/* Acidentes por mês */}
          <Card title="Total de Acidentes de Trabalho 2026" className="row-span-2">
            <HorizontalBars porMes={d.porMes} />
          </Card>

          {/* Principais lesões */}
          <Card title="Principais Lesões (%)" className="row-span-3">
            <BodyDiagram lesoes={d.principaisLesoes} />
          </Card>
        </div>

        {/* ── Linha 2: TF + Treinamentos + Custos ─────────────── */}
        <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.2fr' }}>

          {/* Taxa de Frequência */}
          <Card title="Taxa de Frequência">
            <BarChart data={d.taxaFrequencia} color="#d97706" />
          </Card>

          {/* Treinamentos */}
          <Card title="Treinamentos">
            <div className="flex justify-around items-center gap-2 flex-1">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-1 flex items-center justify-center rounded-full bg-green-100">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-600"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">Treinamentos<br/>Conforme</p>
                <p className="text-sm font-black text-green-600">{pct.conforme}%</p>
                <p className="text-xs font-bold text-green-600">({cfg.treinamentosConforme})</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-1 flex items-center justify-center rounded-full bg-red-100 relative">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-500"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>
                  <span className="absolute -top-1 -right-1 text-red-600 font-black text-base leading-none">×</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">Necessitam de<br/>Treinamentos</p>
                <p className="text-sm font-black text-red-600">{pct.necessitam}%</p>
                <p className="text-xs font-bold text-red-600">({cfg.treinamentosNecessitam})</p>
              </div>
            </div>
          </Card>

          {/* Total de Custos */}
          <Card title="Total de Custos">
            <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-amber-600 opacity-80">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
              </svg>
              <p className="text-xs text-gray-500 leading-tight">(Medicamento, Transporte e Exame)</p>
              <p className="text-xl font-black text-gray-900">{custosFmt}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase">{cfg.mesReferencia}</p>
            </div>
          </Card>
        </div>

        {/* ── Linha 3: TG + Inspeção + DSS ─────────────────────── */}
        <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.2fr' }}>

          {/* Taxa de Gravidade */}
          <Card title="Taxa de Gravidade">
            <BarChart data={d.taxaGravidade} color="#374151" />
          </Card>

          {/* Inspeção de Segurança */}
          <Card title="Inspeção de Segurança">
            <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-gray-700 opacity-80">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              <p className="text-3xl font-black text-gray-900">{cfg.inspecaoSeguranca}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase">{cfg.mesReferencia}</p>
            </div>
          </Card>

          {/* DSS Realizados */}
          <Card title="DSS Realizados">
            <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-gray-700 opacity-80">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              <p className="text-3xl font-black text-gray-900">{cfg.dssRealizados}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase">{cfg.mesReferencia}</p>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
