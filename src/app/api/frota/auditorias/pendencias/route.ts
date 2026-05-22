import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/frota/auditorias/pendencias  — lista todas as pendências abertas
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const severidade = searchParams.get('severidade')
  const responsavelId = searchParams.get('responsavelId')
  const visitaId = searchParams.get('visitaId')
  const vencidas = searchParams.get('vencidas')

  const where: any = {}
  if (status) where.status = status
  if (severidade) where.severidade = severidade
  if (responsavelId) where.responsavelId = responsavelId
  if (visitaId) where.visitaId = visitaId
  if (vencidas === 'true') {
    where.prazo = { lt: new Date() }
    where.status = { in: ['aberta', 'em_tratativa'] }
  }

  const pendencias = await prisma.pendenciaAuditoria.findMany({
    where,
    orderBy: [{ severidade: 'desc' }, { prazo: 'asc' }],
    include: {
      visita: {
        select: {
          id: true,
          dataVisita: true,
          projeto: { select: { id: true, name: true } },
          contrato: { select: { id: true, number: true, name: true } },
          auditor: { select: { id: true, name: true } },
        },
      },
      item: {
        include: {
          ativo: { select: { id: true, tag: true, descricao: true, categoria: true } },
        },
      },
      responsavel: { select: { id: true, name: true } },
    },
  })

  return apiSuccess(pendencias)
}
