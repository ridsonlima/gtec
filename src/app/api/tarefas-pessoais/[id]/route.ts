import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// PATCH /api/tarefas-pessoais/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const tarefa = await prisma.tarefaPessoal.findUnique({ where: { id: params.id } })
  if (!tarefa) return apiError('Tarefa não encontrada', 404)
  if (tarefa.userId !== session.user.id) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { titulo, descricao, status, prioridade, categoria, prazo, recorrente, recorrencia } = body

  const STATUS_VALIDOS = ['pendente', 'em_andamento', 'concluida', 'cancelada']
  const PRIORIDADES    = ['baixa', 'media', 'alta', 'urgente']
  const RECORRENCIAS   = ['diaria', 'semanal', 'quinzenal', 'mensal']

  if (status && !STATUS_VALIDOS.includes(status)) return apiError('Status inválido', 400)
  if (prioridade && !PRIORIDADES.includes(prioridade)) return apiError('Prioridade inválida', 400)
  if (recorrencia && !RECORRENCIAS.includes(recorrencia)) return apiError('Recorrência inválida', 400)

  const data: Record<string, unknown> = {}
  if (titulo !== undefined)      data.titulo      = titulo?.trim() || tarefa.titulo
  if (descricao !== undefined)   data.descricao   = descricao?.trim() || null
  if (status !== undefined)      data.status      = status
  if (prioridade !== undefined)  data.prioridade  = prioridade
  if (categoria !== undefined)   data.categoria   = categoria?.trim() || null
  if (prazo !== undefined)       data.prazo       = prazo ? new Date(prazo) : null
  if (recorrente !== undefined)  data.recorrente  = !!recorrente
  if (recorrencia !== undefined) data.recorrencia = recorrente && recorrencia ? recorrencia : null

  // Marca conclusão automática
  if (status === 'concluida' && tarefa.status !== 'concluida') {
    data.concluidaEm = new Date()
  } else if (status && status !== 'concluida') {
    data.concluidaEm = null
  }

  const updated = await prisma.tarefaPessoal.update({
    where: { id: params.id },
    data,
  })

  return apiSuccess(updated)
}

// DELETE /api/tarefas-pessoais/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const tarefa = await prisma.tarefaPessoal.findUnique({ where: { id: params.id } })
  if (!tarefa) return apiError('Tarefa não encontrada', 404)
  if (tarefa.userId !== session.user.id) return apiError('Sem permissão', 403)

  await prisma.tarefaPessoal.delete({ where: { id: params.id } })

  return apiSuccess({ ok: true })
}
