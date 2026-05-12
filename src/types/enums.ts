/**
 * Enum types para o GTec
 * Definidos aqui porque o SQLite não suporta enums nativos no Prisma 5.
 * Em produção (PostgreSQL), esses tipos são exportados diretamente do @prisma/client.
 */

export type Role = 'admin' | 'director' | 'manager' | 'supervisor' | 'viewer'
export type ReportStatus = 'draft' | 'published' | 'archived'
export type DemandStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
export type DemandPriority = 'critical' | 'high' | 'medium' | 'low'
export type DemandOrigin = 'report' | 'meeting' | 'director' | 'manager' | 'contract' | 'audit' | 'other'
export type ContractStatus = 'active' | 'suspended' | 'closed' | 'at_risk' | 'delayed'
export type CommentType = 'observation' | 'clarification' | 'follow_up' | 'evidence_request'
export type EvidenceStatus = 'pending' | 'received' | 'rejected'
export type ObjectType = 'report' | 'demand' | 'contract' | 'project' | 'comment' | 'evidence_request'
export type NotificationType =
  | 'comment'
  | 'follow_up'
  | 'evidence_requested'
  | 'evidence_received'
  | 'demand_overdue'
  | 'demand_assigned'
  | 'report_published'
export type AgendaStatus = 'preparing' | 'draft' | 'scheduled' | 'done' | 'finalized' | 'held' | 'cancelled'
export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AgendaItemOrigin = 'report' | 'demand' | 'contract' | 'project' | 'manual' | 'director' | 'recurring' | 'other'
export type AgendaItemStatus = 'pending' | 'discussed' | 'done' | 'deferred'
