import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { CreateCommentSchema } from '@/schemas/comment.schema'
import { canAccessArea, canComment } from '@/lib/permissions'
import { audit, ACTIONS } from '@/lib/audit'
import {
  notifyComment,
  notifyFollowUp,
  notifyEvidenceRequested,
  notifyMention,
} from '@/lib/notifications'
import { ZodError } from 'zod'
import type { ObjectType } from '@/types/enums'

// GET /api/comments?objectType=report&objectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const objectType = searchParams.get('objectType') as ObjectType
  const objectId = searchParams.get('objectId')

  if (!objectType || !objectId) {
    return apiError('objectType e objectId são obrigatórios', 400)
  }

  // Busca comentários raiz (sem parentId)
  const comments = await prisma.comment.findMany({
    where: {
      objectType,
      objectId,
      parentId: null,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, role: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
      },
      evidenceRequest: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          description: true,
          responsible: { select: { id: true, name: true } },
        },
      },
    },
  })

  return apiSuccess(comments)
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  try {
    const body = await req.json()
    const data = CreateCommentSchema.parse(body)

    // Resolve a área do objeto para verificar escopo
    let areaId: string | undefined
    if (data.objectType === 'report') {
      const obj = await prisma.report.findUnique({
        where: { id: data.objectId },
        select: { areaId: true },
      })
      areaId = obj?.areaId
    } else if (data.objectType === 'demand') {
      const obj = await prisma.demand.findUnique({
        where: { id: data.objectId },
        select: { areaId: true, requestingAreaId: true },
      })
      areaId = obj?.areaId

      // Colaboradores da demanda também podem comentar
      if (areaId && !canComment(session, areaId)) {
        const requestingOk = obj?.requestingAreaId ? canComment(session, obj.requestingAreaId) : false
        if (!requestingOk) {
          const isCollaborator = await prisma.demandCollaborator.findUnique({
            where: { demandId_userId: { demandId: data.objectId, userId: session.user.id } },
          })
          if (!isCollaborator) return apiError('Sem permissão para comentar neste item', 403)
        }
        areaId = undefined // já validado acima, evita double-check abaixo
      }
    }

    if (areaId && !canComment(session, areaId)) {
      return apiError('Sem permissão para comentar neste item', 403)
    }

    // Cria comentário
    const comment = await prisma.comment.create({
      data: {
        objectType: data.objectType as ObjectType,
        objectId: data.objectId,
        parentId: data.parentId ?? null,
        authorId: session.user.id,
        type: data.type as any,
        content: data.content,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        replies: true,
      },
    })

    // Se for solicitação de evidência, cria o registro formal
    if (
      data.type === 'evidence_request' &&
      data.evidenceResponsibleId &&
      data.evidenceDescription
    ) {
      await prisma.evidenceRequest.create({
        data: {
          objectType: data.objectType as ObjectType,
          objectId: data.objectId,
          commentId: comment.id,
          requestedById: session.user.id,
          responsibleId: data.evidenceResponsibleId,
          description: data.evidenceDescription,
          dueDate: data.evidenceDueDate ? new Date(data.evidenceDueDate) : null,
          status: 'pending',
        },
      })

      notifyEvidenceRequested(
        data.objectType as ObjectType,
        data.objectId,
        data.evidenceResponsibleId,
        session.user.name,
        data.evidenceDescription
      ).catch(console.error)
    }

    // Notificações por tipo de comentário
    if (data.type === 'follow_up' && data.parentId === null) {
      // Cobranças: notifica os gestores da área
      if (areaId) {
        const managers = await prisma.userAreaScope.findMany({
          where: { areaId, canWrite: true },
          select: { userId: true },
        })
        const targetIds = managers
          .map((m) => m.userId)
          .filter((id) => id !== session.user.id)

        notifyFollowUp(
          data.objectType as ObjectType,
          data.objectId,
          targetIds[0] ?? '',
          session.user.name,
          data.content
        ).catch(console.error)
      }
    }

    // Processa menções: cria registros e notifica usuários mencionados
    if (data.mentionedUserIds?.length) {
      await prisma.mention.createMany({
        data: data.mentionedUserIds.map((userId) => ({
          commentId: comment.id,
          userId,
        })),
        skipDuplicates: true,
      })

      const toNotify = data.mentionedUserIds.filter((id) => id !== session.user.id)
      Promise.all(
        toNotify.map((userId) =>
          notifyMention(data.objectType, data.objectId, userId, session.user.name, data.content)
        )
      ).catch(console.error)
    }

    await audit({
      userId: session.user.id,
      action: ACTIONS.COMMENT_CREATED,
      objectType: data.objectType,
      objectId: data.objectId,
    })

    return apiSuccess(comment, 201)
  } catch (e) {
    if (e instanceof ZodError) return apiError('Dados inválidos', 422, e.errors)
    console.error('[POST /api/comments]', e)
    return apiError('Erro interno', 500)
  }
}
