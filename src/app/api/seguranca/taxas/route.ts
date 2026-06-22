import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageSeguranca } from '@/lib/permissions'
import { z } from 'zod'

const ANO = 2026
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

const PutSchema = z.object({
  mes:                     z.string().min(1),
  totalEmpregados:         z.number().int().min(0).optional(),
  totalHorasTrabalhadas:   z.number().min(0).optional(),
  acidentesComAfastamento: z.number().int().min(0).optional(),
  acidentesSemAfastamento: z.number().int().min(0).optional(),
  diasPerdidos:            z.number().int().min(0).optional(),
  diasDebitados:           z.number().min(0).optional(),
})

const MILHAO = 1_000_000

/**
 * Fórmulas NBR 14280 (Cadastro de acidente do trabalho):
 *   TF (Taxa de Frequência) = (nº acidentes com afastamento × 1.000.000) / HHT
 *   TG (Taxa de Gravidade)  = ((dias perdidos + dias debitados) × 1.000.000) / HHT
 * onde HHT = homens-horas trabalhadas (horas de exposição ao risco no mês).
 */
function calcularTaxas(hht: number, comAfastamento: number, diasPerdidos: number, diasDebitados: number) {
  const tf = hht > 0 ? (comAfastamento * MILHAO) / hht : 0
  const tg = hht > 0 ? ((diasPerdidos + diasDebitados) * MILHAO) / hht : 0
  return {
    taxaFrequencia: Math.round(tf * 100) / 100,
    taxaGravidade:  Math.round(tg * 100) / 100,
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const taxas = await prisma.taxaFrequencia.findMany({ where: { ano: ANO } })
  const ordenadas = [...taxas].sort((a, b) => MESES.indexOf(a.mes) - MESES.indexOf(b.mes))
  return apiSuccess(ordenadas)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data
  const mes = d.mes.toUpperCase()
  if (!MESES.includes(mes)) return apiError('Mês inválido', 400)

  const hht          = d.totalHorasTrabalhadas ?? 0
  const comAfast     = d.acidentesComAfastamento ?? 0
  const semAfast     = d.acidentesSemAfastamento ?? 0
  const diasPerdidos = d.diasPerdidos ?? 0
  const diasDebitados = d.diasDebitados ?? 0
  const totalAcidentes = comAfast + semAfast
  const { taxaFrequencia, taxaGravidade } = calcularTaxas(hht, comAfast, diasPerdidos, diasDebitados)

  const data = {
    totalEmpregados:         d.totalEmpregados ?? 0,
    totalHorasTrabalhadas:   hht,
    acidentesComAfastamento: comAfast,
    acidentesSemAfastamento: semAfast,
    totalAcidentes,
    diasPerdidos,
    diasDebitados,
    totalDiasPerdidos:       diasPerdidos + diasDebitados,
    taxaFrequencia,
    taxaGravidade,
  }

  const taxa = await prisma.taxaFrequencia.upsert({
    where: { mes_ano: { mes, ano: ANO } },
    create: { mes, ano: ANO, ...data },
    update: data,
  })

  return apiSuccess(taxa)
}
