import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

// POST /api/frota/auditorias/[id]/concluir
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const visita = await prisma.auditoriaVisita.findUnique({
    where: { id: params.id },
    include: {
      projeto: { select: { id: true, name: true, responsibleId: true } },
      contrato: { select: { id: true, number: true, responsibleId: true } },
      auditor: { select: { id: true, name: true } },
      _count: { select: { itens: true } },
      pendencias: { where: { severidade: 'critica', status: 'aberta' }, select: { id: true } },
    },
  })
  if (!visita) return apiError('Visita não encontrada', 404)
  if (visita.status !== 'em_andamento')
    return apiError('Apenas visitas em andamento podem ser concluídas', 400)

  const podeConculir =
    ['master', 'admin'].includes(session.user.role) || visita.auditorId === session.user.id
  if (!podeConculir) return apiError('Sem permissão', 403)

  if (visita._count.itens === 0)
    return apiError('Registre ao menos um item no checklist antes de concluir', 400)

  const updated = await prisma.auditoriaVisita.update({
    where: { id: params.id },
    data: { status: 'concluida' },
  })

  // notifica responsável do projeto ou contrato sobre pendências críticas
  const responsavelId = visita.projeto?.responsibleId || visita.contrato?.responsibleId
  if (responsavelId && visita.pendencias.length > 0) {
    const local = visita.projeto?.name ?? `Contrato ${visita.contrato?.number}`
    await createNotification({
      userId: responsavelId,
      type: 'auditoria_pendencias_criticas',
      title: `${visita.pendencias.length} pendência(s) crítica(s) na auditoria`,
      body: `${visita.auditor.name} concluiu auditoria em ${local} com itens críticos`,
      objectType: 'auditoria_visita',
      objectId: params.id,
    })
  }

  // notifica gestores (master/admin/director) sobre qualquer conclusão
  const gestores = await prisma.user.findMany({
    where: { role: { in: ['master', 'admin', 'director'] }, isActive: true },
    select: { id: true },
  })
  if (gestores.length) {
    const local = visita.projeto?.name ?? `Contrato ${visita.contrato?.number}`
    await prisma.notification.createMany({
      data: gestores.map((g) => ({
        userId: g.id,
        type: 'auditoria_concluida',
        title: 'Auditoria de campo concluída',
        body: `${visita.auditor.name} — ${local} | ${visita._count.itens} itens, ${visita.pendencias.length} crítica(s)`,
        objectType: 'auditoria_visita',
        objectId: params.id,
      })),
      skipDuplicates: true,
    })
  }

  return apiSuccess(updated)
}
