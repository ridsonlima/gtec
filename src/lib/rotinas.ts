import { prisma } from './prisma'
import { periodKey, periodEnd, type Frequencia } from './rotinaPeriodo'

type RotinaLike = { id: string; frequencia: string; inicioEm?: Date | null }

/**
 * Garante que existe a ocorrência do CICLO ATUAL da rotina, criando-a (estado
 * 'aberta') se o agendador ainda não tiver rodado. Usada tanto pelo cron quanto
 * pelas rotas de escrita (fallback lazy), para o responsável nunca ficar travado.
 */
export async function ensureOcorrenciaAtual(rotina: RotinaLike, ref = new Date()) {
  const freq = rotina.frequencia as Frequencia
  const periodo = periodKey(freq, ref)
  const prazo = periodEnd(freq, periodo)

  const existente = await prisma.rotinaOcorrencia.findUnique({
    where: { rotinaId_periodo: { rotinaId: rotina.id, periodo } },
  })
  if (existente) return existente

  return prisma.rotinaOcorrencia.create({
    data: { rotinaId: rotina.id, periodo, prazo, estado: 'aberta' },
  })
}
