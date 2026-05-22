import { z } from 'zod'

export const CreateDemandSchema = z.object({
  areaId: z.string().uuid('ID de área inválido'),
  requestingAreaId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  reportId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Título muito curto').max(200),
  context: z.string().max(3000).optional(),
  responsibleId: z.string().uuid('Responsável inválido'),
  collaboratorIds: z.array(z.string().uuid()).max(10).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  dueDate: z.string().min(1, 'Prazo obrigatório'),
  blockers: z.string().max(1000).optional(),
  supportNeeded: z.string().max(1000).optional(),
  origin: z
    .enum(['report', 'meeting', 'director', 'manager', 'contract', 'audit', 'interarea', 'other'])
    .default('director'),
})

export const UpdateDemandSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  context: z.string().max(3000).optional(),
  responsibleId: z.string().uuid().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  dueDate: z.string().optional(),
  blockers: z.string().max(1000).optional().nullable(),
  supportNeeded: z.string().max(1000).optional().nullable(),
  status: z
    .enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
    .optional(),
})

export const CreateDemandUpdateSchema = z.object({
  content: z.string().min(1, 'Conteúdo obrigatório').max(3000),
  statusBefore: z
    .enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
    .optional()
    .nullable(),
  statusAfter: z
    .enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
    .optional()
    .nullable(),
})

export type CreateDemandInput = z.infer<typeof CreateDemandSchema>
export type UpdateDemandInput = z.infer<typeof UpdateDemandSchema>
export type CreateDemandUpdateInput = z.infer<typeof CreateDemandUpdateSchema>
