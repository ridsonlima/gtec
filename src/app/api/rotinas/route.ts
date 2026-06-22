import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { periodKey, periodLabel, type Frequencia } from '@/lib/rotinaPeriodo'

const FREQS = ['diaria', 'semanal', 'mensal']

// GET /api/rotinas?areaId=&escopo=minhas|todas
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const areaId = req.nextUrl.searchParams.get('areaId')
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)

  const podeVerTodas = canManageRotina(session.user.role)
  const escopo = req.nextUrl.searchParams.get('escopo') === 'todas' && podeVerTodas ? 'todas' : 'minhas'

  const rotinas = await prisma.rotinaArea.findMany({
    where: { areaId, ativo: true, ...(escopo === 'minhas' ? { responsavelId: session.user.id } : {}) },
    orderBy: [{ frequencia: 'asc' }, { createdAt: 'asc' }],
  })
  if (rotinas.length === 0) return apiSuccess([])

  // Nomes dos responsáveis (sem relação formal no schema)
  const userIds = Array.from(new Set(rotinas.map((r) => r.responsavelId)))
  const periodos = Array.from(new Set(rotinas.map((r) => periodKey(r.frequencia as Frequencia))))

  const conclusoes = await prisma.rotinaConclusao.findMany({
    where: { rotinaId: { in: rotinas.map((r) => r.id) }, periodo: { in: periodos } },
  })
  const conclMap = new Map(conclusoes.map((c) => [`${c.rotinaId}|${c.periodo}`, c]))
  const concluidoPorIds = conclusoes.map((c) => c.concluidoPorId)

  const allUserIds = Array.from(new Set([...userIds, ...concluidoPorIds]))
  const users = await prisma.user.findMany({ where: { id: { in: allUserIds } }, select: { id: true, name: true } })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  const entregaIds = conclusoes.map((c) => c.id)
  const anexos = entregaIds.length
    ? await prisma.attachment.findMany({
        where: { objectType: 'rotina_entrega', objectId: { in: entregaIds } },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      })
    : []
  const anexosByEntrega = new Map<string, any[]>()
  for (const a of anexos) {
    const list = anexosByEntrega.get(a.objectId) ?? []
    list.push(a)
    anexosByEntrega.set(a.objectId, list)
  }

  const result = rotinas.map((r) => {
    const pk = periodKey(r.frequencia as Frequencia)
    const c = conclMap.get(`${r.id}|${pk}`)
    return {
      id: r.id,
      title: r.title,
      descricao: r.descricao,
      instrucoes: r.instrucoes,
      frequencia: r.frequencia,
      cicloLabel: periodLabel(r.frequencia as Frequencia),
      responsavel: { id: r.responsavelId, name: userMap.get(r.responsavelId) ?? '—' },
      ehMinha: r.responsavelId === session.user.id,
      entrega: c
        ? {
            id: c.id,
            status: c.status,
            texto: c.texto,
            concluidoEm: c.concluidoEm,
            concluidoPor: userMap.get(c.concluidoPorId) ?? '—',
            anexos: anexosByEntrega.get(c.id) ?? [],
          }
        : null,
    }
  })

  return apiSuccess(result)
}

// POST /api/rotinas — líder cria e atribui a rotina a um usuário
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageRotina(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { areaId, title, descricao, instrucoes, frequencia = 'semanal', responsavelId } = body
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)
  if (!title?.trim()) return apiError('Título obrigatório', 400)
  if (!responsavelId) return apiError('Selecione o responsável', 400)
  if (!FREQS.includes(frequencia)) return apiError('Frequência inválida', 400)

  const rotina = await prisma.rotinaArea.create({
    data: {
      areaId,
      responsavelId,
      title: title.trim(),
      descricao: descricao?.trim() || null,
      instrucoes: instrucoes?.trim() || null,
      frequencia,
      createdById: session.user.id,
    },
  })
  return apiSuccess(rotina, 201)
}
