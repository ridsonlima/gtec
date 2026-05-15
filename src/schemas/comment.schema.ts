import { z } from 'zod'

export const CreateCommentSchema = z.object({
  objectType: z.enum(['report', 'demand', 'contract', 'project']),
  objectId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
  type: z
    .enum(['observation', 'clarification', 'follow_up', 'evidence_request'])
    .default('observation'),
  content: z.string().min(1, 'Comentário não pode ser vazio').max(5000),
  dueDate: z.string().optional().nullable(),
  // Campos extras para evidence_request
  evidenceResponsibleId: z.string().uuid().optional(),
  evidenceDescription: z.string().max(1000).optional(),
  evidenceDueDate: z.string().optional().nullable(),
  // Menções a usuários específicos
  mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
})

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  isResolved: z.boolean().optional(),
})

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>
