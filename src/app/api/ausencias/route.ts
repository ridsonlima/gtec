import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove } from '@/lib/permissions'

const MOTIVOS = ['ferias', 'licenca_medica', 'viagem', 'outro'] as const

function activeFilter() {
  return {
    ativo: true,
    OR: [
      { dataFim: null as null },
      { dataFim: { gte: new Date() } },
    ],
  }
}

// ─── GET /api/ausencias ───────────────────────────────────────────────────────
// ?me=true  → status do usuário logado (ausente ou cobrindo)
// ?todas=true → inclui encerradas (histórico)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const meOnly = req.nextUrl.searchParams.get('me') === 'true'
  const todas  = req.nextUrl.searchParams.get('todas') === 'true'

  if (meOnly) {
    const [ausencia, coberturas] = await Promise.all([
      // O próprio usuário está ausente?
      prisma.avisoAusencia.findFirst({
        where: { usuarioId: session.user.id, ...activeFilter() },
        include: {
          substituto: { select: { id: true, name: true } },
          criadoPor:  { select: { id: true, name: true } },
        },
      }),
      // O usuário está cobrindo alguém?
      prisma.avisoAusencia.findMany({
        where: { substitutoId: session.user.id, ...activeFilter() },
        include: {
          usuario:  { select: { id: true, name: true } },
          criadoPor:{ select: { id: true, name: true } },
        },
      }),
    ])
    return apiSuccess({ ausencia, coberturas })
  }

  const where = todas ? {} : activeFilter()

  const ausencias = await prisma.avisoAusencia.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      usuario:   { select: { id: true, name: true, role: true } },
      substituto:{ select: { id: true, name: true, role: true } },
      criadoPor: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(ausencias)
}

// ─── POST /api/ausencias ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { usuarioId, substitutoId, motivo = 'ferias', dataInicio, dataFim, observacoes } = body

  if (!usuarioId)   return apiError('usuarioId obrigatório', 400)
  if (!substitutoId) return apiError('substitutoId obrigatório', 400)
  if (!dataInicio)  return apiError('dataInicio obrigatório', 400)
  if (!MOTIVOS.includes(motivo)) return apiError('Motivo inválido', 400)
  if (usuarioId === substitutoId) return apiError('O substituto não pode ser o mesmo usuário', 400)

  // Valida datas
  const inicio = new Date(dataInicio)
  const fim    = dataFim ? new Date(dataFim) : null
  if (fim && fim <= inicio) return apiError('Data de retorno deve ser após a data de início', 400)

  // Verifica se o usuário já tem uma ausência ativa
  const jaAusente = await prisma.avisoAusencia.findFirst({
    where: { usuarioId, ...activeFilter() },
  })
  if (jaAusente) return apiError('Este colaborador já possui uma ausência ativa. Encerre a anterior antes de criar uma nova.', 400)

  // Verifica se os usuários existem
  const [usuario, substituto] = await Promise.all([
    prisma.user.findUnique({ where: { id: usuarioId },    select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: substitutoId }, select: { id: true, name: true } }),
  ])
  if (!usuario)    return apiError('Usuário ausente não encontrado', 404)
  if (!substituto) return apiError('Substituto não encontrado', 404)

  // Coordenador só registra ausência de quem é da sua equipe (diretoria registra qualquer um)
  const isLeadership = ['master', 'admin', 'director'].includes(session.user.role)
  if (!isLeadership) {
    const myAreaIds = session.user.areaScopes.map((s) => s.areaId)
    const alvoScopes = await prisma.userAreaScope.findMany({ where: { userId: usuarioId }, select: { areaId: true } })
    const daEquipe = alvoScopes.some((s) => myAreaIds.includes(s.areaId))
    if (!daEquipe) return apiError('Você só pode registrar ausência de membros da sua área', 403)
  }

  const aviso = await prisma.avisoAusencia.create({
    data: {
      usuarioId,
      substitutoId,
      criadoPorId: session.user.id,
      motivo,
      dataInicio:  inicio,
      dataFim:     fim,
      observacoes: observacoes?.trim() || null,
    },
    include: {
      usuario:   { select: { id: true, name: true } },
      substituto:{ select: { id: true, name: true } },
      criadoPor: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(aviso, 201)
}
