import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { isManagerOrAbove, isDirector } from '@/lib/permissions'

const PRIORIDADES = ['normal', 'importante', 'urgente'] as const
const CATEGORIAS = ['comunicado', 'novidade'] as const

// GET /api/comunicados — lista comunicados relevantes ao usuário, com status de leitura/aceite
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const todas = req.nextUrl.searchParams.get('todas') === 'true'
  const minhasAreaIds = (session.user.areaScopes ?? []).map((s) => s.areaId)
  const verTudo = isDirector(session.user.role)

  // Visibilidade: 'todos' para todos; 'area' para quem é da área (diretoria vê todas);
  // 'usuario' só para o alvo (nunca vaza para outros, nem diretoria).
  const where: any = {
    ativo: true,
    OR: [
      { alvoTipo: 'todos' },
      { alvoTipo: 'area', alvoAreaId: { in: minhasAreaIds } },
      { alvoTipo: 'usuario', alvoUsuarioId: session.user.id },
    ],
  }
  if (verTudo) where.OR.push({ alvoTipo: 'area' })

  const comunicados = await prisma.comunicado.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      author:   { select: { id: true, name: true } },
      alvoArea: { select: { id: true, name: true } },
      leituras: {
        where: { userId: session.user.id },
        select: { lidoEm: true, aceiteEm: true },
      },
      _count: { select: { leituras: { where: { aceiteEm: { not: null } } } } },
    },
  })

  // Para gestores: total de destinatários por comunicado (para % de aceite)
  const result = comunicados.map((c) => ({
    id: c.id,
    title: c.title,
    body: c.body,
    prioridade: c.prioridade,
    categoria: c.categoria,
    alvoTipo: c.alvoTipo,
    alvoArea: c.alvoArea,
    exigeAceite: c.exigeAceite,
    author: c.author,
    createdAt: c.createdAt,
    minhaLeitura: c.leituras[0] ?? null,
    totalAceites: c._count.leituras,
  }))

  return apiSuccess(result)
}

// POST /api/comunicados — cria comunicado (gestores)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!isManagerOrAbove(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { title, body: texto, prioridade = 'normal', categoria = 'comunicado', alvoTipo = 'todos', alvoAreaId, alvoUsuarioId, exigeAceite = true } = body

  if (!title?.trim()) return apiError('Título obrigatório', 400)
  if (!texto?.trim()) return apiError('Conteúdo obrigatório', 400)
  if (!PRIORIDADES.includes(prioridade)) return apiError('Prioridade inválida', 400)
  if (!CATEGORIAS.includes(categoria)) return apiError('Categoria inválida', 400)
  if (alvoTipo === 'area' && !alvoAreaId) return apiError('Selecione a área de destino', 400)
  if (alvoTipo === 'usuario' && !alvoUsuarioId) return apiError('Selecione o usuário de destino', 400)

  // Novidades (changelog do sistema) nunca exigem aceite formal — basta a leitura.
  const isNovidade = categoria === 'novidade'

  const comunicado = await prisma.comunicado.create({
    data: {
      title: title.trim(),
      body: texto.trim(),
      authorId: session.user.id,
      prioridade,
      categoria,
      alvoTipo,
      alvoAreaId: alvoTipo === 'area' ? alvoAreaId : null,
      alvoUsuarioId: alvoTipo === 'usuario' ? alvoUsuarioId : null,
      exigeAceite: isNovidade ? false : Boolean(exigeAceite),
    },
    include: {
      author:   { select: { id: true, name: true } },
      alvoArea: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(comunicado, 201)
}
