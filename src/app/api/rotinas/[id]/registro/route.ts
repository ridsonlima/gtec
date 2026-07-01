import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { ensureOcorrenciaAtual } from '@/lib/rotinas'

// POST /api/rotinas/[id]/registro — adiciona uma entrada no logbook do ciclo atual.
// Cria a ocorrência do ciclo se ainda não existir (fallback lazy do agendador).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)
  const podeRegistrar = rotina.responsavelId === session.user.id || canManageRotina(session.user.role)
  if (!podeRegistrar) return apiError('Apenas o responsável registra nesta rotina', 403)

  let texto: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.texto === 'string') texto = body.texto.trim() || null
  } catch { /* registro só com anexo (adicionado depois) */ }

  const oc = await ensureOcorrenciaAtual(rotina)

  const registro = await prisma.rotinaRegistro.create({
    data: { ocorrenciaId: oc.id, texto, autorId: session.user.id },
  })

  return apiSuccess({ registroId: registro.id, ocorrenciaId: oc.id }, 201)
}

// DELETE /api/rotinas/[id]/registro?registroId= — remove uma entrada do logbook
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const rotina = await prisma.rotinaArea.findUnique({ where: { id: params.id } })
  if (!rotina) return apiError('Rotina não encontrada', 404)
  if (!canAccessArea(session, rotina.areaId)) return apiError('Sem acesso', 403)

  const registroId = req.nextUrl.searchParams.get('registroId')
  if (!registroId) return apiError('registroId obrigatório', 400)

  const registro = await prisma.rotinaRegistro.findUnique({ where: { id: registroId } })
  if (!registro) return apiError('Registro não encontrado', 404)

  // autor do registro ou líder da área podem remover
  const podeRemover = registro.autorId === session.user.id || canManageRotina(session.user.role)
  if (!podeRemover) return apiError('Sem permissão', 403)

  await prisma.attachment.deleteMany({ where: { objectType: 'rotina_registro', objectId: registroId } })
  await prisma.rotinaRegistro.delete({ where: { id: registroId } })

  return apiSuccess({ ok: true })
}
