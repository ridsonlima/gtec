import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }
const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor']

const PatchSchema = z.object({
  tipo:               z.enum(['interferencia', 'paralisacao']).optional(),
  local:              z.string().max(200).nullable().optional(),
  descricao:          z.string().min(1).max(2000).optional(),
  responsavelExterno: z.string().max(160).nullable().optional(),
  dataInicio:         z.string().optional(),
  dataFim:            z.string().nullable().optional(),
  status:             z.enum(['aberta', 'resolvida']).optional(),
})

// GET /api/obras/interferencias/[id] — detalhe com fotos
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const item = await prisma.obraInterferencia.findUnique({
    where: { id: params.id },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  if (!item) return apiError('Interferência não encontrada', 404)

  const attachments = await prisma.attachment.findMany({
    where: { objectType: 'interferencia', objectId: params.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  })

  return apiSuccess({ ...item, attachments })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const exists = await prisma.obraInterferencia.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Interferência não encontrada', 404)

  const d = parsed.data
  const dataInicio = d.dataInicio ? new Date(d.dataInicio) : undefined
  const dataFim = d.dataFim === null ? null : d.dataFim ? new Date(d.dataFim) : undefined

  const updated = await prisma.obraInterferencia.update({
    where: { id: params.id },
    data: {
      ...(d.tipo               !== undefined && { tipo: d.tipo }),
      ...(d.local              !== undefined && { local: d.local }),
      ...(d.descricao          !== undefined && { descricao: d.descricao.trim() }),
      ...(d.responsavelExterno !== undefined && { responsavelExterno: d.responsavelExterno }),
      ...(dataInicio           !== undefined && { dataInicio }),
      ...(dataFim              !== undefined && { dataFim }),
      ...(d.status             !== undefined && { status: d.status }),
    },
  })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  await prisma.attachment.deleteMany({ where: { objectType: 'interferencia', objectId: params.id } })
  await prisma.obraInterferencia.deleteMany({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
