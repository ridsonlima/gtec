import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

// POST /api/frota/ordens-servico/[id]/iniciar  — aberta → em_execucao
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const os = await prisma.ordemServico.findUnique({ where: { id: params.id } })
  if (!os) return apiError('Ordem de serviço não encontrada', 404)
  if (os.status !== 'aberta')
    return apiError('Apenas OS abertas podem ser iniciadas', 400)

  const updated = await prisma.ordemServico.update({
    where: { id: params.id },
    data: { status: 'em_execucao' },
  })

  return apiSuccess(updated)
}
