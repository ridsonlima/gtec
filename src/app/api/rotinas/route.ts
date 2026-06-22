import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { periodKey, periodLabel, type Frequencia } from '@/lib/rotinaPeriodo'

const FREQS = ['diaria', 'semanal', 'mensal']

// GET /api/rotinas?areaId= — rotinas da área + status do ciclo atual
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const areaId = req.nextUrl.searchParams.get('areaId')
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)

  const rotinas = await prisma.rotinaArea.findMany({
    where: { areaId, ativo: true },
    orderBy: [{ frequencia: 'asc' }, { createdAt: 'asc' }],
  })

  const periodos = Array.from(new Set(rotinas.map((r) => periodKey(r.frequencia as Frequencia))))
  const conclusoes = periodos.length
    ? await prisma.rotinaConclusao.findMany({
        where: { rotinaId: { in: rotinas.map((r) => r.id) }, periodo: { in: periodos } },
        select: { rotinaId: true, periodo: true, concluidoEm: true },
      })
    : []
  const map = new Map(conclusoes.map((c) => [`${c.rotinaId}|${c.periodo}`, c]))

  const result = rotinas.map((r) => {
    const pk = periodKey(r.frequencia as Frequencia)
    const c = map.get(`${r.id}|${pk}`)
    return {
      id: r.id,
      title: r.title,
      descricao: r.descricao,
      frequencia: r.frequencia,
      cicloLabel: periodLabel(r.frequencia as Frequencia),
      concluidoNoCiclo: !!c,
      concluidoEm: c?.concluidoEm ?? null,
    }
  })

  return apiSuccess(result)
}

// POST /api/rotinas — cria rotina (gestores/supervisores)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageRotina(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { areaId, title, descricao, frequencia = 'semanal' } = body
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)
  if (!title?.trim()) return apiError('Título obrigatório', 400)
  if (!FREQS.includes(frequencia)) return apiError('Frequência inválida', 400)

  const rotina = await prisma.rotinaArea.create({
    data: {
      areaId,
      title: title.trim(),
      descricao: descricao?.trim() || null,
      frequencia,
      createdById: session.user.id,
    },
  })
  return apiSuccess(rotina, 201)
}
