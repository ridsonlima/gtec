import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

type Params = { params: { id: string } }
const PODE_ESCREVER = ['master', 'admin', 'director', 'manager', 'supervisor', 'viewer'] // criar/preencher
const PODE_APAGAR = ['master', 'admin', 'director', 'manager', 'supervisor']            // apagar (sem técnico)

const FuncaoSchema = z.object({ funcao: z.string().min(1).max(120), quantidade: z.number().int().min(0) })
const AtivoSchema = z.object({
  ativoId: z.string().uuid().nullable().optional(),
  tipo: z.enum(['maquina', 'equipamento', 'veiculo']),
  descricao: z.string().min(1).max(200),
  quantidade: z.number().int().min(1).default(1),
  origem: z.enum(['rental', 'externo']).default('rental'),
})

const PatchSchema = z.object({
  contratoId:     z.string().uuid().optional(),
  dataVisita:     z.string().optional(),
  analistaId:     z.string().uuid().optional(),
  producaoDia:    z.string().max(2000).nullable().optional(),
  teveOcorrencia: z.boolean().optional(),
  ocorrencias:    z.string().max(4000).nullable().optional(),
  opiniao:        z.string().max(8000).nullable().optional(),
  funcoes:        z.array(FuncaoSchema).optional(),
  ativos:         z.array(AtivoSchema).optional(),
})

// GET /api/acompanhamento/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const relatorio = await prisma.relatorioAcompanhamento.findUnique({
    where: { id: params.id },
    include: {
      contrato: { select: { id: true, number: true, name: true } },
      analista: { select: { id: true, name: true } },
      funcoes: { orderBy: { funcao: 'asc' } },
      ativos: { orderBy: { tipo: 'asc' }, include: { ativo: { select: { id: true, tag: true } } } },
    },
  })
  if (!relatorio) return apiError('Relatório não encontrado', 404)

  const attachments = await prisma.attachment.findMany({
    where: { objectType: 'relatorio_acomp', objectId: params.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  })

  return apiSuccess({ ...relatorio, attachments })
}

// PATCH /api/acompanhamento/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_ESCREVER.includes(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  const exists = await prisma.relatorioAcompanhamento.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Relatório não encontrado', 404)

  const d = parsed.data
  const dataVisita = d.dataVisita ? new Date(d.dataVisita) : undefined
  if (dataVisita && isNaN(dataVisita.getTime())) return apiError('Data inválida', 400)

  await prisma.$transaction(async (tx) => {
    await tx.relatorioAcompanhamento.update({
      where: { id: params.id },
      data: {
        ...(d.contratoId     !== undefined && { contratoId: d.contratoId }),
        ...(dataVisita       !== undefined && { dataVisita }),
        ...(d.analistaId     !== undefined && { analistaId: d.analistaId }),
        ...(d.producaoDia    !== undefined && { producaoDia: d.producaoDia }),
        ...(d.teveOcorrencia !== undefined && { teveOcorrencia: d.teveOcorrencia }),
        ...(d.ocorrencias    !== undefined && { ocorrencias: d.ocorrencias }),
        ...(d.opiniao        !== undefined && { opiniao: d.opiniao }),
      },
    })

    if (d.funcoes !== undefined) {
      await tx.relatorioAcompFuncao.deleteMany({ where: { relatorioId: params.id } })
      if (d.funcoes.length > 0) {
        await tx.relatorioAcompFuncao.createMany({
          data: d.funcoes.filter((f) => f.funcao.trim()).map((f) => ({ relatorioId: params.id, funcao: f.funcao.trim(), quantidade: f.quantidade })),
        })
      }
    }

    if (d.ativos !== undefined) {
      await tx.relatorioAcompAtivo.deleteMany({ where: { relatorioId: params.id } })
      if (d.ativos.length > 0) {
        await tx.relatorioAcompAtivo.createMany({
          data: d.ativos.map((a) => ({
            relatorioId: params.id,
            ativoId: a.ativoId ?? null,
            tipo: a.tipo,
            descricao: a.descricao.trim(),
            quantidade: a.quantidade,
            origem: a.origem,
          })),
        })
      }
    }
  })

  const updated = await prisma.relatorioAcompanhamento.findUnique({
    where: { id: params.id },
    include: {
      contrato: { select: { id: true, number: true, name: true } },
      analista: { select: { id: true, name: true } },
      funcoes: { orderBy: { funcao: 'asc' } },
      ativos: { orderBy: { tipo: 'asc' } },
    },
  })
  return apiSuccess(updated)
}

// DELETE /api/acompanhamento/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!PODE_APAGAR.includes(session.user.role)) return apiError('Sem permissão', 403)

  const exists = await prisma.relatorioAcompanhamento.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return apiError('Relatório não encontrado', 404)

  await prisma.relatorioAcompFuncao.deleteMany({ where: { relatorioId: params.id } })
  await prisma.relatorioAcompAtivo.deleteMany({ where: { relatorioId: params.id } })
  await prisma.relatorioAcompanhamento.delete({ where: { id: params.id } })
  return apiSuccess({ ok: true })
}
