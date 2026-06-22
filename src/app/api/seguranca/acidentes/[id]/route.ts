import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageSeguranca } from '@/lib/permissions'
import { z } from 'zod'

type Params = { params: { id: string } }
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

const PatchSchema = z.object({
  nome:                 z.string().min(1).max(160).optional(),
  cargo:                z.string().max(80).nullable().optional(),
  dataOcorrencia:       z.string().optional(),
  trechoObra:           z.string().max(160).nullable().optional(),
  diasPerdidos:         z.number().int().min(0).optional(),
  tipoAcidente:         z.enum(['Típico', 'Trajeto']).optional(),
  afastamento:          z.enum(['ASA', 'ACA']).optional(),
  turno:                z.string().max(20).nullable().optional(),
  areaLesionada:        z.string().max(60).nullable().optional(),
  situacaoInvestigacao: z.string().max(40).nullable().optional(),
  valoresGastos:        z.number().min(0).nullable().optional(),
  agenteCausador:       z.string().max(120).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const exists = await prisma.acidente.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Acidente não encontrado', 404)

  const d = parsed.data
  let dataOcorrencia: Date | undefined
  let mes: string | undefined
  if (d.dataOcorrencia) {
    const dt = new Date(d.dataOcorrencia)
    if (isNaN(dt.getTime())) return apiError('Data inválida', 400)
    dataOcorrencia = dt
    mes = MESES[dt.getMonth()]
  }

  const updated = await prisma.acidente.update({
    where: { id: params.id },
    data: {
      ...(d.nome                 !== undefined && { nome: d.nome }),
      ...(d.cargo                !== undefined && { cargo: d.cargo }),
      ...(dataOcorrencia         !== undefined && { dataOcorrencia, mes }),
      ...(d.trechoObra           !== undefined && { trechoObra: d.trechoObra }),
      ...(d.diasPerdidos         !== undefined && { diasPerdidos: d.diasPerdidos }),
      ...(d.tipoAcidente         !== undefined && { tipoAcidente: d.tipoAcidente }),
      ...(d.afastamento          !== undefined && { afastamento: d.afastamento }),
      ...(d.turno                !== undefined && { turno: d.turno }),
      ...(d.areaLesionada        !== undefined && { areaLesionada: d.areaLesionada }),
      ...(d.situacaoInvestigacao !== undefined && { situacaoInvestigacao: d.situacaoInvestigacao }),
      ...(d.valoresGastos        !== undefined && { valoresGastos: d.valoresGastos }),
      ...(d.agenteCausador       !== undefined && { agenteCausador: d.agenteCausador }),
    },
  })

  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageSeguranca(session)) return apiError('Sem permissão', 403)

  const exists = await prisma.acidente.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Acidente não encontrado', 404)

  await prisma.acidente.delete({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
