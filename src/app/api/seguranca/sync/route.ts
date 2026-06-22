import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/*
  POST /api/seguranca/sync
  Chamado pelo Google Apps Script a cada hora.
  Requer header: Authorization: Bearer <SEGURANCA_SYNC_KEY>
*/

function ok(data: unknown) {
  return NextResponse.json({ ok: true, data }, { status: 200 })
}
function err(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(req: NextRequest) {
  // Autenticação por chave secreta
  const auth = req.headers.get('authorization') ?? ''
  const key  = auth.replace('Bearer ', '').trim()
  const expected = process.env.SEGURANCA_SYNC_KEY

  if (!expected || key !== expected) {
    return err('Chave inválida', 401)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido')
  }

  const ano = Number(body.ano ?? 2026)

  // ── 1. Config (valores estáticos do dashboard) ──────────────
  if (body.config) {
    const c = body.config
    await prisma.segurancaConfig.upsert({
      where:  { ano },
      create: {
        ano,
        diasSemAcidentes:       Number(c.diasSemAcidentes       ?? 0),
        treinamentosConforme:   Number(c.treinamentosConforme    ?? 0),
        treinamentosNecessitam: Number(c.treinamentosNecessitam  ?? 0),
        totalCustos:            Number(c.totalCustos             ?? 0),
        inspecaoSeguranca:      Number(c.inspecaoSeguranca       ?? 0),
        dssRealizados:          Number(c.dssRealizados           ?? 0),
        mesReferencia:          String(c.mesReferencia           ?? 'ATUAL'),
        syncedAt: new Date(),
      },
      update: {
        diasSemAcidentes:       Number(c.diasSemAcidentes       ?? 0),
        treinamentosConforme:   Number(c.treinamentosConforme    ?? 0),
        treinamentosNecessitam: Number(c.treinamentosNecessitam  ?? 0),
        totalCustos:            Number(c.totalCustos             ?? 0),
        inspecaoSeguranca:      Number(c.inspecaoSeguranca       ?? 0),
        dssRealizados:          Number(c.dssRealizados           ?? 0),
        mesReferencia:          String(c.mesReferencia           ?? 'ATUAL'),
        syncedAt: new Date(),
      },
    })
  }

  // ── 2. Taxa de frequência / gravidade ───────────────────────
  if (Array.isArray(body.taxas) && body.taxas.length > 0) {
    for (const t of body.taxas) {
      const mes = String(t.mes ?? '').toUpperCase()
      if (!mes) continue
      await prisma.taxaFrequencia.upsert({
        where:  { mes_ano: { mes, ano } },
        create: {
          mes, ano,
          totalEmpregados:         Number(t.totalEmpregados         ?? 0),
          totalHorasTrabalhadas:   Number(t.totalHorasTrabalhadas   ?? 0),
          acidentesComAfastamento: Number(t.acidentesComAfastamento ?? 0),
          acidentesSemAfastamento: Number(t.acidentesSemAfastamento ?? 0),
          totalAcidentes:          Number(t.totalAcidentes          ?? 0),
          diasPerdidos:            Number(t.diasPerdidos            ?? 0),
          totalDiasPerdidos:       Number(t.totalDiasPerdidos       ?? 0),
          taxaFrequencia:          Number(t.taxaFrequencia          ?? 0),
          taxaGravidade:           Number(t.taxaGravidade           ?? 0),
          indiceRelativo:          t.indiceRelativo != null ? Number(t.indiceRelativo) : null,
        },
        update: {
          totalEmpregados:         Number(t.totalEmpregados         ?? 0),
          totalHorasTrabalhadas:   Number(t.totalHorasTrabalhadas   ?? 0),
          acidentesComAfastamento: Number(t.acidentesComAfastamento ?? 0),
          acidentesSemAfastamento: Number(t.acidentesSemAfastamento ?? 0),
          totalAcidentes:          Number(t.totalAcidentes          ?? 0),
          diasPerdidos:            Number(t.diasPerdidos            ?? 0),
          totalDiasPerdidos:       Number(t.totalDiasPerdidos       ?? 0),
          taxaFrequencia:          Number(t.taxaFrequencia          ?? 0),
          taxaGravidade:           Number(t.taxaGravidade           ?? 0),
          indiceRelativo:          t.indiceRelativo != null ? Number(t.indiceRelativo) : null,
        },
      })
    }
  }

  // ── 3. Registros de acidentes ────────────────────────────────
  if (Array.isArray(body.acidentes) && body.acidentes.length > 0) {
    // Remove todos do ano e reinsere (planilha é a fonte da verdade)
    await prisma.acidente.deleteMany({ where: { ano } })

    for (const a of body.acidentes) {
      if (!a.nome || !a.dataOcorrencia) continue
      await prisma.acidente.create({
        data: {
          codigo:               a.codigo               ? String(a.codigo)               : null,
          nome:                 String(a.nome),
          cargo:                a.cargo                ? String(a.cargo)                : null,
          dataAdmissao:         a.dataAdmissao         ? new Date(a.dataAdmissao)        : null,
          dataOcorrencia:       new Date(a.dataOcorrencia),
          trechoObra:           a.trechoObra           ? String(a.trechoObra)           : null,
          mes:                  String(a.mes ?? '').toUpperCase(),
          ano,
          diasPerdidos:         Number(a.diasPerdidos  ?? 0),
          tipoAcidente:         String(a.tipoAcidente  ?? 'Típico'),
          afastamento:          String(a.afastamento   ?? 'ACA'),
          horarioAcidente:      a.horarioAcidente      ? String(a.horarioAcidente)      : null,
          turno:                a.turno                ? String(a.turno)                : null,
          areaLesionada:        a.areaLesionada        ? String(a.areaLesionada)        : null,
          situacaoInvestigacao: a.situacaoInvestigacao ? String(a.situacaoInvestigacao) : null,
          valoresGastos:        a.valoresGastos        ? Number(a.valoresGastos)        : null,
          cid:                  a.cid                  ? String(a.cid)                  : null,
          agenteCausador:       a.agenteCausador       ? String(a.agenteCausador)       : null,
        },
      })
    }
  }

  return ok({ message: 'Sincronizado com sucesso', ano, timestamp: new Date().toISOString() })
}
