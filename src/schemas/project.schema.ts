import { z } from 'zod'

export const CreateProjectSchema = z.object({
  name:            z.string().min(3, 'Nome obrigatório').max(200),
  objective:       z.string().max(2000).optional().nullable(),
  contractId:      z.string().uuid().optional().nullable(),
  responsibleId:   z.string().uuid('Responsável inválido'),
  status:          z.enum(['planned', 'in_progress', 'completed', 'cancelled']).default('planned'),
  startDate:       z.string().optional().nullable(),
  expectedEndDate: z.string().optional().nullable(),
  riskLevel:       z.enum(['low', 'medium', 'high', 'critical']).default('low'),
})

export const CreateMilestoneSchema = z.object({
  title:       z.string().min(2).max(200),
  description: z.string().max(1000).optional().nullable(),
  dueDate:     z.string(),
})

export const CreateProjectUpdateSchema = z.object({
  content: z.string().min(1).max(2000),
})

export type CreateProjectInput  = z.infer<typeof CreateProjectSchema>
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>
