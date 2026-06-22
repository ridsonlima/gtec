import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { z } from 'zod'

type Params = { params: { id: string } }

const PatchSchema = z.object({
  nome:        z.string().min(1).max(160).optional(),
  cpf:         z.string().max(20).nullable().optional(),
  matricula:   z.string().max(40).nullable().optional(),
  cargo:       z.string().max(80).nullable().optional(),
  fotoUrl:     z.string().url().nullable().optional(),
  empresa:     z.string().max(120).nullable().optional(),
  vinculo:     z.enum(['proprio', 'terceirizado']).optional(),
  situacao:    z.enum(['contratado', 'avulso']).optional(),
  regime:      z.enum(['diaria', 'clt', 'pj']).optional(),
  alojado:     z.boolean().optional(),
  alojamento:  z.string().max(120).nullable().optional(),
  contrato:    z.string().max(120).nullable().optional(),
  contratoId:  z.string().uuid().nullable().optional(),
  ativo:       z.boolean().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
})

// GET /api/funcionarios/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const funcionario = await prisma.funcionario.findUnique({
    where: { id: params.id },
    include: {
      treinamentos: { orderBy: { nome: 'asc' } },
      contratoRef: { select: { id: true, number: true, name: true } },
    },
  })
  if (!funcionario) return apiError('Funcionário não encontrado', 404)

  const contratos = await prisma.contract.findMany({
    where: { status: { in: ['active', 'at_risk'] } },
    select: { id: true, number: true, name: true },
    orderBy: { number: 'asc' },
  })

  return apiSuccess({ funcionario, contratos })
}

// PATCH /api/funcionarios/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const exists = await prisma.funcionario.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Funcionário não encontrado', 404)

  const d = parsed.data
  const updated = await prisma.funcionario.update({
    where: { id: params.id },
    data: {
      ...(d.nome        !== undefined && { nome: d.nome }),
      ...(d.cpf         !== undefined && { cpf: d.cpf }),
      ...(d.matricula   !== undefined && { matricula: d.matricula }),
      ...(d.cargo       !== undefined && { cargo: d.cargo }),
      ...(d.fotoUrl     !== undefined && { fotoUrl: d.fotoUrl }),
      ...(d.empresa     !== undefined && { empresa: d.empresa }),
      ...(d.vinculo     !== undefined && { vinculo: d.vinculo }),
      ...(d.situacao    !== undefined && { situacao: d.situacao }),
      ...(d.regime      !== undefined && { regime: d.regime }),
      ...(d.alojado     !== undefined && { alojado: d.alojado }),
      ...(d.alojamento  !== undefined && { alojamento: d.alojamento }),
      ...(d.contrato    !== undefined && { contrato: d.contrato }),
      ...(d.contratoId  !== undefined && { contratoId: d.contratoId }),
      ...(d.ativo       !== undefined && { ativo: d.ativo }),
      ...(d.observacoes !== undefined && { observacoes: d.observacoes }),
    },
    include: {
      treinamentos: { orderBy: { nome: 'asc' } },
      contratoRef: { select: { id: true, number: true, name: true } },
    },
  })

  return apiSuccess(updated)
}

// DELETE /api/funcionarios/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const exists = await prisma.funcionario.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Funcionário não encontrado', 404)

  // relationMode = prisma → remover filhos manualmente
  await prisma.funcionarioTreinamento.deleteMany({ where: { funcionarioId: params.id } })
  await prisma.funcionario.delete({ where: { id: params.id } })

  return apiSuccess({ ok: true })
}
