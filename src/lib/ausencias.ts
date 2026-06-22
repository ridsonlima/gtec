import { prisma } from './prisma'

function activeFilter() {
  return {
    ativo: true,
    OR: [
      { dataFim: null as null },
      { dataFim: { gte: new Date() } },
    ],
  }
}

/** IDs dos usuários que o substituto está cobrindo agora */
export async function getCoveredUserIds(substitutoId: string): Promise<string[]> {
  const records = await prisma.avisoAusencia.findMany({
    where: { substitutoId, ...activeFilter() },
    select: { usuarioId: true },
  })
  return records.map((r) => r.usuarioId)
}

/** Ausência ativa do usuário (se estiver de férias/ausente) */
export async function getActiveAusencia(usuarioId: string) {
  return prisma.avisoAusencia.findFirst({
    where: { usuarioId, ...activeFilter() },
    include: {
      substituto: { select: { id: true, name: true } },
      criadoPor:  { select: { id: true, name: true } },
    },
  })
}

/** Cobertura que o usuário está realizando agora (ele é o substituto) */
export async function getActiveCobertura(substitutoId: string) {
  return prisma.avisoAusencia.findMany({
    where: { substitutoId, ...activeFilter() },
    include: {
      usuario:  { select: { id: true, name: true } },
      criadoPor:{ select: { id: true, name: true } },
    },
  })
}

export const MOTIVO_AUSENCIA_LABEL: Record<string, string> = {
  ferias:         'férias',
  licenca_medica: 'licença médica',
  viagem:         'viagem a trabalho',
  outro:          'ausência',
}

export type SubstituicaoInfo = {
  substitutoId: string
  substitutoNome: string
  motivo: string
  dataFim: Date | null
}

/**
 * Retorna, para uma lista de usuários, quais estão ausentes agora e quem os cobre.
 * Usado para sinalizar a substituição em tudo que a pessoa ausente aparece.
 */
export async function getAusenciasMap(userIds: (string | null | undefined)[]): Promise<Map<string, SubstituicaoInfo>> {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)))
  const map = new Map<string, SubstituicaoInfo>()
  if (ids.length === 0) return map

  const records = await prisma.avisoAusencia.findMany({
    where: { usuarioId: { in: ids }, ...activeFilter() },
    include: { substituto: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  for (const r of records) {
    if (!map.has(r.usuarioId)) {
      map.set(r.usuarioId, {
        substitutoId: r.substituto.id,
        substitutoNome: r.substituto.name,
        motivo: r.motivo,
        dataFim: r.dataFim,
      })
    }
  }
  return map
}
