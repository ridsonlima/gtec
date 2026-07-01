import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }
const PODE = ['master', 'admin', 'manager', 'supervisor']

const PatchSchema = z.object({
  nome:         z.string().min(1).max(120).optional(),
  cnh:          z.string().max(30).nullable().optional(),
  categoriaCnh: z.string().max(10).nullable().optional(),
  validadeCnh:  z.string().nullable().optional(),
  telefone:     z.string().max(30).nullable().optional(),
  observacoes:  z.string().max(500).nullable().optional(),
  ativo:        z.boolean().optional(),
  // veículos atrelados (substitui o vínculo): lista de ativoIds
  veiculoIds:   z.array(z.string().uuid()).optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())
  const d = parsed.data

  const exists = await prisma.condutor.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Condutor não encontrado', 404)

  await prisma.condutor.update({
    where: { id: params.id },
    data: {
      ...(d.nome         !== undefined && { nome: d.nome.trim() }),
      ...(d.cnh          !== undefined && { cnh: d.cnh }),
      ...(d.categoriaCnh !== undefined && { categoriaCnh: d.categoriaCnh }),
      ...(d.validadeCnh  !== undefined && { validadeCnh: d.validadeCnh ? new Date(d.validadeCnh) : null }),
      ...(d.telefone     !== undefined && { telefone: d.telefone }),
      ...(d.observacoes  !== undefined && { observacoes: d.observacoes }),
      ...(d.ativo        !== undefined && { ativo: d.ativo }),
    },
  })

  // Atualiza vínculo de veículos (condutorAtualId)
  if (d.veiculoIds !== undefined) {
    await prisma.ativo.updateMany({ where: { condutorAtualId: params.id }, data: { condutorAtualId: null } })
    if (d.veiculoIds.length > 0) {
      await prisma.ativo.updateMany({ where: { id: { in: d.veiculoIds }, tipo: 'veiculo' }, data: { condutorAtualId: params.id } })
    }
  }

  const updated = await prisma.condutor.findUnique({
    where: { id: params.id },
    include: { veiculos: { select: { id: true, tag: true, placa: true, descricao: true } }, _count: { select: { multas: true } } },
  })
  return apiSuccess(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE.includes(session.user.role)) return apiError('Sem permissão', 403)

  const multas = await prisma.veiculoMulta.count({ where: { condutorId: params.id } })
  if (multas > 0) return apiError(`Condutor possui ${multas} multa(s) vinculada(s). Não pode ser excluído.`, 400)

  await prisma.ativo.updateMany({ where: { condutorAtualId: params.id }, data: { condutorAtualId: null } })
  await prisma.condutor.delete({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
