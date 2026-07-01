import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { z } from 'zod'

const AtivoSchema = z.object({
  tag:                z.string().min(1).max(60),
  tipo:               z.enum(['equipamento', 'veiculo']),
  categoria:          z.string().max(80).optional().default(''),
  descricao:          z.string().min(1).max(300),
  marca:              z.string().max(80).nullable().optional(),
  modelo:             z.string().max(80).nullable().optional(),
  anoFabricacao:      z.number().int().nullable().optional(),
  placa:              z.string().max(20).nullable().optional(),
  numeroserie:        z.string().max(80).nullable().optional(),
  valorLocacaoMensal: z.number().min(0).optional().default(0),
})

const BodySchema = z.object({
  ativos: z.array(AtivoSchema).min(1).max(2000),
})

// POST /api/frota/ativos/importar — upsert em lote por TAG
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role)) {
    return apiError('Sem permissão', 403)
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError('Dados inválidos', 400, parsed.error.flatten())

  let inseridos = 0, atualizados = 0
  const erros: { tag: string; erro: string }[] = []

  for (const a of parsed.data.ativos) {
    const tag = a.tag.toUpperCase().trim()
    try {
      const data = {
        tipo: a.tipo,
        categoria: a.categoria || 'Outros',
        descricao: a.descricao,
        marca: a.marca || null,
        modelo: a.modelo || null,
        anoFabricacao: a.anoFabricacao ?? null,
        placa: a.placa ? a.placa.toUpperCase().trim() : null,
        numeroserie: a.numeroserie || null,
        valorLocacaoMensal: a.valorLocacaoMensal ?? 0,
      }
      const existente = await prisma.ativo.findUnique({ where: { tag }, select: { id: true } })
      if (existente) {
        await prisma.ativo.update({ where: { tag }, data })
        atualizados++
      } else {
        await prisma.ativo.create({ data: { tag, status: 'disponivel', ...data } })
        inseridos++
      }
    } catch (e) {
      erros.push({ tag, erro: e instanceof Error ? e.message.slice(0, 120) : 'erro' })
    }
  }

  return apiSuccess({ inseridos, atualizados, erros, total: parsed.data.ativos.length })
}
