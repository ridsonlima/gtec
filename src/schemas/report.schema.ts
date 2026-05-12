import { z } from 'zod'

export const CreateReportSchema = z.object({
  areaId: z.string().uuid('ID de área inválido'),
  contractId: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Título muito curto').max(200),
  period: z.string().max(50).optional(),
  executiveSummary: z.string().max(2000).optional(),
  evolutions: z.string().max(3000).optional(),
  criticalPoints: z.string().max(3000).optional(),
  attentionPoints: z.string().max(3000).optional(),
  risks: z.string().max(2000).optional(),
  blockers: z.string().max(2000).optional(),
  decisionsNeeded: z.string().max(2000).optional(),
  nextSteps: z.string().max(2000).optional(),
  pendingItems: z.string().max(2000).optional(),
  agendaSuggestion: z.string().max(1000).optional(),
})

export const UpdateReportSchema = CreateReportSchema.partial()

export type CreateReportInput = z.infer<typeof CreateReportSchema>
export type UpdateReportInput = z.infer<typeof UpdateReportSchema>
