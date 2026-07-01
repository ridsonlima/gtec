import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea } from '@/lib/permissions'
import { periodShortLabel, type Frequencia } from '@/lib/rotinaPeriodo'

// GET /api/rotinas/[id]/historico — todas as ocorrências passadas + logbook (acumulativo).
// É a resposta ao "como consulto o histórico de forma acumulativa": nada some.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)

  const ocorrencias = await prisma.rotinaOcorrencia.findMany({
    where: { rotinaId: rotina.id },
    orderBy: { prazo: 'desc' },
    include: { registros: { orderBy: { createdAt: 'asc' } } },
  })

  const regIds = ocorrencias.flatMap((o) => o.registros.map((r) => r.id))
  const anexos = regIds.length
    ? await prisma.attachment.findMany({
        where: { objectType: 'rotina_registro', objectId: { in: regIds } },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      })
    : []
  const anexosByReg = new Map<string, any[]>()
  for (const a of anexos) {
    const list = anexosByReg.get(a.objectId) ?? []
    list.push(a)
    anexosByReg.set(a.objectId, list)
  }

  const userIds = new Set<string>()
  ocorrencias.forEach((o) => {
    if (o.fechadoPorId) userIds.add(o.fechadoPorId)
    o.registros.forEach((r) => userIds.add(r.autorId))
  })
  const users = await prisma.user.findMany({ where: { id: { in: Array.from(userIds) } }, select: { id: true, name: true } })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  const freq = rotina.frequencia as Frequencia
  const result = {
    rotina: { id: rotina.id, title: rotina.title, frequencia: rotina.frequencia, instrucoes: rotina.instrucoes },
    ocorrencias: ocorrencias.map((o) => ({
      id: o.id,
      periodo: o.periodo,
      periodoLabel: periodShortLabel(freq, o.periodo),
      prazo: o.prazo,
      estado: o.estado,
      statusFechamento: o.statusFechamento,
      resumo: o.resumo,
      fechadoEm: o.fechadoEm,
      fechadoPor: o.fechadoPorId ? (userMap.get(o.fechadoPorId) ?? '—') : null,
      registros: o.registros.map((r) => ({
        id: r.id,
        texto: r.texto,
        autor: userMap.get(r.autorId) ?? '—',
        createdAt: r.createdAt,
        anexos: anexosByReg.get(r.id) ?? [],
      })),
    })),
  }

  return apiSuccess(result)
}
