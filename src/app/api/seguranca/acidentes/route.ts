import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageSeguranca } from '@/lib/permissions'
import { z } from 'zod'

const ANO = 2026
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

const CreateAcidenteSchema = z.object({
  nome:                 z.string().min(1).max(160),
  cargo:                z.string().max(80).nullable().optional(),
  dataOcorrencia:       z.string().min(1),
  trechoObra:           z.string().max(160).nullable().optional(),
  diasPerdidos:         z.number().int().min(0).optional(),
  tipoAcidente:         z.enum(['Típico', 'Trajeto']).default('Típico'),
  afastamento:          z.enum(['ASA', 'ACA']).default('ASA'),
  turno:                z.string().max(20).nullable().optional(),
  areaLesionada:        z.string().max(60).nullable().optional(),
  situacaoInvestigacao: z.string().max(40).nullable().optional(),
  valoresGastos:        z.number().min(0).nullable().optional(),
  agenteCausador:       z.string().max(120).nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const acidentes = await prisma.acidente.findMany({
    where: { ano: ANO },
    orderBy: { dataOcorrencia: 'desc' },
  })
  return apiSuccess(acidentes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateAcidenteSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const data = new Date(d.dataOcorrencia)
  if (isNaN(data.getTime())) return apiError('Data inválida', 400)
  const mes = MESES[data.getMonth()]

  const created = await prisma.acidente.create({
    data: {
      nome: d.nome,
      cargo: d.cargo ?? null,
      dataOcorrencia: data,
      trechoObra: d.trechoObra ?? null,
      mes,
      ano: ANO,
      diasPerdidos: d.diasPerdidos ?? 0,
      tipoAcidente: d.tipoAcidente,
      afastamento: d.afastamento,
      turno: d.turno ?? null,
      areaLesionada: d.areaLesionada ?? null,
      situacaoInvestigacao: d.situacaoInvestigacao ?? null,
      valoresGastos: d.valoresGastos ?? null,
      agenteCausador: d.agenteCausador ?? null,
    },
  })

  return apiSuccess(created, 201)
}
