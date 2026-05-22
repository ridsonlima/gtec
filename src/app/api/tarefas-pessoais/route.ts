import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// GET /api/tarefas-pessoais
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const tarefas = await prisma.tarefaPessoal.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: 'asc' }, { prazo: 'asc' }, { createdAt: 'desc' }],
  })

  return apiSuccess(tarefas)
}

// POST /api/tarefas-pessoais
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const body = await req.json()
  const { titulo, descricao, prioridade = 'media', categoria, prazo } = body

  if (!titulo?.trim()) return apiError('Título obrigatório', 400)

  const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente']
  if (!PRIORIDADES.includes(prioridade)) return apiError('Prioridade inválida', 400)

  const tarefa = await prisma.tarefaPessoal.create({
    data: {
      userId:    session.user.id,
      titulo:    titulo.trim(),
      descricao: descricao?.trim() || null,
      prioridade,
      categoria: categoria?.trim() || null,
      prazo:     prazo ? new Date(prazo) : null,
    },
  })

  return apiSuccess(tarefa, 201)
}
