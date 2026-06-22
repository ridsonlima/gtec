import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

const MESES_ORDER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// Normaliza área lesionada → grupo de lesão
function grupoLesao(area: string | null): string {
  if (!area) return 'Outros'
  const a = area.toUpperCase()
  if (a.includes('CABEÇA') || a.includes('FACE') || a.includes('CABECA')) return 'Cabeça/Face'
  if (a.includes('COLUNA') || a.includes('TRONCO') || a.includes('OMBRO') || a.includes('COSTA')) return 'Coluna/Tronco'
  if (a.includes('BRAÇO') || a.includes('BRACO') || a.includes('COTOVELO') || a.includes('ANTEBRAÇO')) return 'Braço/Cotovelo'
  if (a.includes('MÃO') || a.includes('MAO') || a.includes('DEDO') || a.includes('PUNHO')) return 'Mãos/Dedos'
  if (a.includes('JOELHO') || a.includes('PERNA') || a.includes('COXA')) return 'Joelho/Perna'
  if (a.includes('PÉ') || a.includes('PE') || a.includes('TORNOZELO') || a.includes('CALCANHAR')) return 'Pé/Tornozelo'
  return 'Outros'
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const ano = 2026

  const [acidentes, taxas, config] = await Promise.all([
    prisma.acidente.findMany({ where: { ano } }),
    prisma.taxaFrequencia.findMany({ where: { ano } }),
    prisma.segurancaConfig.findUnique({ where: { ano } }),
  ])

  const total = acidentes.length

  // Acidentes por mês
  const porMes: Record<string, number> = {}
  for (const a of acidentes) {
    porMes[a.mes] = (porMes[a.mes] ?? 0) + 1
  }

  // Ocorrências por turno
  const porTurno: Record<string, number> = {}
  for (const a of acidentes) {
    const t = a.turno ?? 'Não informado'
    porTurno[t] = (porTurno[t] ?? 0) + 1
  }

  // Situação da investigação
  const porSituacao: Record<string, number> = {}
  for (const a of acidentes) {
    const s = a.situacaoInvestigacao ?? 'Não informado'
    porSituacao[s] = (porSituacao[s] ?? 0) + 1
  }

  // Principais lesões agrupadas
  const lesoesBruto: Record<string, number> = {}
  for (const a of acidentes) {
    const g = grupoLesao(a.areaLesionada)
    lesoesBruto[g] = (lesoesBruto[g] ?? 0) + 1
  }
  const principaisLesoes = Object.entries(lesoesBruto)
    .map(([nome, count]) => ({ nome, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)

  // Taxa de frequência e gravidade por mês (sorted)
  const taxasOrdenadas = [...taxas].sort(
    (a, b) => MESES_ORDER.indexOf(a.mes) - MESES_ORDER.indexOf(b.mes),
  )

  const taxaFrequencia = taxasOrdenadas.map((t) => ({ mes: t.mes, valor: t.taxaFrequencia }))
  const taxaGravidade  = taxasOrdenadas.map((t) => ({ mes: t.mes, valor: t.taxaGravidade }))

  return apiSuccess({
    total,
    porMes,
    porTurno,
    porSituacao,
    principaisLesoes,
    taxaFrequencia,
    taxaGravidade,
    config: config ?? null,
  })
}
