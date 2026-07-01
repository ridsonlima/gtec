import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { periodKey, type Frequencia } from '@/lib/rotinaPeriodo'

// GET /api/rotinas/conformidade?areaId= — rollup de conformidade por rotina (líder/diretoria).
// % no prazo, faltas e sequência (streak) sobre os ciclos JÁ ENCERRADOS.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageRotina(session.user.role)) return apiError('Sem permissão', 403)

  const areaId = req.nextUrl.searchParams.get('areaId')
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)

  const rotinas = await prisma.rotinaArea.findMany({
    where: { areaId, ativo: true },
    orderBy: [{ frequencia: 'asc' }, { createdAt: 'asc' }],
  })
  if (rotinas.length === 0) return apiSuccess({ rotinas: [], totais: { entregues: 0, perdidas: 0, noPrazoPct: null } })

  const ocorrencias = await prisma.rotinaOcorrencia.findMany({
    where: { rotinaId: { in: rotinas.map((r) => r.id) } },
    orderBy: { prazo: 'desc' }, // mais recente primeiro (para streak)
    select: { rotinaId: true, estado: true, statusFechamento: true, periodo: true, prazo: true },
  })
  const ocByRotina = new Map<string, typeof ocorrencias>()
  for (const o of ocorrencias) {
    const list = ocByRotina.get(o.rotinaId) ?? []
    list.push(o)
    ocByRotina.set(o.rotinaId, list)
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(rotinas.map((r) => r.responsavelId))) } },
    select: { id: true, name: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  let totEntregues = 0, totPerdidas = 0

  const rotinasOut = rotinas.map((r) => {
    const freq = r.frequencia as Frequencia
    const pkAtual = periodKey(freq)
    // ciclos encerrados = ocorrências que não são o ciclo atual em aberto
    const lista = (ocByRotina.get(r.id) ?? []).filter((o) => !(o.periodo === pkAtual && o.estado === 'aberta'))
    const entregues = lista.filter((o) => o.estado === 'entregue').length
    const perdidas = lista.filter((o) => o.estado === 'perdida').length
    const total = entregues + perdidas
    totEntregues += entregues
    totPerdidas += perdidas

    // streak: sequência de 'entregue' a partir do ciclo encerrado mais recente
    let streak = 0
    for (const o of lista) { // já ordenado prazo desc
      if (o.estado === 'entregue') streak++
      else break
    }

    return {
      id: r.id,
      title: r.title,
      frequencia: r.frequencia,
      responsavel: { id: r.responsavelId, name: userMap.get(r.responsavelId) ?? '—' },
      totalCiclos: total,
      entregues,
      perdidas,
      noPrazoPct: total > 0 ? Math.round((entregues / total) * 100) : null,
      streak,
    }
  })

  const totalGeral = totEntregues + totPerdidas
  return apiSuccess({
    rotinas: rotinasOut,
    totais: {
      entregues: totEntregues,
      perdidas: totPerdidas,
      noPrazoPct: totalGeral > 0 ? Math.round((totEntregues / totalGeral) * 100) : null,
    },
  })
}
