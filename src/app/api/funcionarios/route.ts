import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canManageFuncionarios } from '@/lib/permissions'
import { resumoTreinamentos } from '@/lib/funcionarios'
import { z } from 'zod'

const CreateSchema = z.object({
  nome:        z.string().min(1).max(160),
  cpf:         z.string().max(20).nullable().optional(),
  matricula:   z.string().max(40).nullable().optional(),
  cargo:       z.string().max(80).nullable().optional(),
  fotoUrl:     z.string().url().nullable().optional(),
  empresa:     z.string().max(120).nullable().optional(),
  vinculo:     z.enum(['proprio', 'terceirizado']).default('proprio'),
  situacao:    z.enum(['contratado', 'avulso']).default('contratado'),
  regime:      z.enum(['diaria', 'clt', 'pj']).default('clt'),
  alojado:     z.boolean().default(false),
  alojamento:  z.string().max(120).nullable().optional(),
  contrato:    z.string().max(120).nullable().optional(),
  contratoId:  z.string().uuid().nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
})

// GET /api/funcionarios — lista com filtros
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const { searchParams } = req.nextUrl
  const search   = searchParams.get('search')?.trim()
  const vinculo  = searchParams.get('vinculo')
  const situacao = searchParams.get('situacao')
  const regime   = searchParams.get('regime')
  const alojado  = searchParams.get('alojado')
  const ativo    = searchParams.get('ativo')

  const where: any = {}
  if (vinculo)  where.vinculo = vinculo
  if (situacao) where.situacao = situacao
  if (regime)   where.regime = regime
  if (alojado === 'true')  where.alojado = true
  if (alojado === 'false') where.alojado = false
  if (ativo === 'false') where.ativo = false
  else if (ativo !== 'all') where.ativo = true
  if (search) {
    where.OR = [
      { nome: { contains: search, mode: 'insensitive' } },
      { empresa: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search } },
      { matricula: { contains: search } },
      { cargo: { contains: search, mode: 'insensitive' } },
    ]
  }

  const contratoId = searchParams.get('contratoId')
  if (contratoId) where.contratoId = contratoId

  const funcionarios = await prisma.funcionario.findMany({
    where,
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: {
      treinamentos: { select: { realizadoEm: true, validade: true } },
      contratoRef: { select: { id: true, number: true, name: true } },
    },
  })

  // Lista de empresas distintas (para autocomplete)
  const empresasRaw = await prisma.funcionario.findMany({
    where: { empresa: { not: null } },
    select: { empresa: true },
    distinct: ['empresa'],
    orderBy: { empresa: 'asc' },
  })
  const empresas = empresasRaw.map((e) => e.empresa).filter(Boolean)

  // Contratos para o seletor de alocação
  const contratos = await prisma.contract.findMany({
    where: { status: { in: ['active', 'at_risk'] } },
    select: { id: true, number: true, name: true },
    orderBy: { number: 'asc' },
  })

  // Alertas de treinamento sobre TODOS os ativos (independe dos filtros aplicados)
  const ativos = await prisma.funcionario.findMany({
    where: { ativo: true },
    select: {
      id: true, nome: true, fotoUrl: true, empresa: true,
      treinamentos: { select: { nome: true, realizadoEm: true, validade: true } },
    },
  })
  const alertas = ativos
    .map((a) => {
      const r = resumoTreinamentos(a.treinamentos)
      return { id: a.id, nome: a.nome, fotoUrl: a.fotoUrl, empresa: a.empresa, vencidos: r.vencidos, aVencer: r.aVencer }
    })
    .filter((a) => a.vencidos > 0 || a.aVencer > 0)
    .sort((a, b) => b.vencidos - a.vencidos || b.aVencer - a.aVencer)

  const alertasResumo = {
    totalVencidos: alertas.reduce((s, a) => s + a.vencidos, 0),
    totalAVencer: alertas.reduce((s, a) => s + a.aVencer, 0),
    funcionarios: alertas,
  }

  return apiSuccess({ funcionarios, empresas, contratos, alertas: alertasResumo })
}

// POST /api/funcionarios — cria funcionário
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageFuncionarios(session)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const d = parsed.data
  const created = await prisma.funcionario.create({
    data: {
      nome: d.nome,
      cpf: d.cpf ?? null,
      matricula: d.matricula ?? null,
      cargo: d.cargo ?? null,
      fotoUrl: d.fotoUrl ?? null,
      empresa: d.empresa ?? null,
      vinculo: d.vinculo,
      situacao: d.situacao,
      regime: d.regime,
      alojado: d.alojado,
      alojamento: d.alojamento ?? null,
      contrato: d.contrato ?? null,
      contratoId: d.contratoId ?? null,
      observacoes: d.observacoes ?? null,
      createdById: session.user.id,
    },
  })

  return apiSuccess(created, 201)
}
