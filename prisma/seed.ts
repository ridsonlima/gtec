/**
 * GTec — Seed de dados realistas para desenvolvimento e demo
 *
 * Execução: npm run db:seed
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...\n')

  // ─── LIMPAR DADOS EXISTENTES ─────────────────────────────────────────────
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.agendaItem.deleteMany()
  await prisma.meetingAgenda.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.evidenceRequest.deleteMany()
  await prisma.comment.updateMany({ data: { parentId: null } })
  await prisma.comment.deleteMany()
  await prisma.demandUpdate.deleteMany()
  await prisma.demand.deleteMany()
  await prisma.reportVersion.deleteMany()
  await prisma.report.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.userAreaScope.deleteMany()
  await prisma.user.deleteMany()
  await prisma.area.deleteMany()

  console.log('🗑️  Dados anteriores removidos')

  // ─── ÁREAS ───────────────────────────────────────────────────────────────
  const areas = await Promise.all([
    prisma.area.create({
      data: {
        name: 'Planejamento de Obras',
        code: 'PLAN',
        isOperational: false,
        description: 'Planejamento, orçamento, cronograma e contratos novos',
        sortOrder: 1,
      },
    }),
    prisma.area.create({
      data: {
        name: 'Obras Próprias',
        code: 'OBRAS_PROP',
        isOperational: true,
        description: 'Execução de obras com equipe própria',
        sortOrder: 2,
      },
    }),
    prisma.area.create({
      data: {
        name: 'Obras Terceirizadas',
        code: 'OBRAS_TERC',
        isOperational: true,
        description: 'Fiscalização e gestão de contratos terceirizados',
        sortOrder: 3,
      },
    }),
    prisma.area.create({
      data: {
        name: 'SESMT e Logística',
        code: 'SESMT',
        isOperational: false,
        description: 'Segurança do trabalho, medicina e logística de campo',
        sortOrder: 4,
      },
    }),
    prisma.area.create({
      data: {
        name: 'Equipamentos e Almoxarifado',
        code: 'EQUIP',
        isOperational: false,
        description: 'Frota, equipamentos e controle de materiais',
        sortOrder: 5,
      },
    }),
  ])

  const [areaPlano, areaObrasProp, areaObrasTerc, areaSesmt, areaEquip] = areas
  console.log('✅ 5 áreas criadas')

  // ─── USUÁRIOS ─────────────────────────────────────────────────────────────
  const senha = await bcrypt.hash('gtec@2026', 12)

  const ridson = await prisma.user.create({
    data: {
      name: 'Ridson Lima',
      email: 'ridsonlima@gmail.com',
      passwordHash: senha,
      role: 'director',
    },
  })

  const joao = await prisma.user.create({
    data: {
      name: 'João Ferreira',
      email: 'joao.ferreira@empresa.com',
      passwordHash: senha,
      role: 'manager',
    },
  })

  const ana = await prisma.user.create({
    data: {
      name: 'Ana Costa',
      email: 'ana.costa@empresa.com',
      passwordHash: senha,
      role: 'manager',
    },
  })

  const carlos = await prisma.user.create({
    data: {
      name: 'Carlos Silva',
      email: 'carlos.silva@empresa.com',
      passwordHash: senha,
      role: 'supervisor',
    },
  })

  const marcos = await prisma.user.create({
    data: {
      name: 'Marcos Pereira',
      email: 'marcos.pereira@empresa.com',
      passwordHash: senha,
      role: 'manager',
    },
  })

  const lucia = await prisma.user.create({
    data: {
      name: 'Lúcia Ramos',
      email: 'lucia.ramos@empresa.com',
      passwordHash: senha,
      role: 'supervisor',
    },
  })

  const admin = await prisma.user.create({
    data: {
      name: 'Administrador GTec',
      email: 'admin@empresa.com',
      passwordHash: senha,
      role: 'admin',
    },
  })

  console.log('✅ 7 usuários criados (senha padrão: gtec@2026)')

  // ─── ESCOPOS DE ÁREA ──────────────────────────────────────────────────────
  await prisma.userAreaScope.createMany({
    data: [
      // João → Obras Próprias (primário, escrita)
      { userId: joao.id, areaId: areaObrasProp.id, canWrite: true, isPrimary: true },
      // Ana → Obras Terceirizadas (primário, escrita)
      { userId: ana.id, areaId: areaObrasTerc.id, canWrite: true, isPrimary: true },
      // Carlos → SESMT (primário, escrita)
      { userId: carlos.id, areaId: areaSesmt.id, canWrite: true, isPrimary: true },
      // Carlos também → Obras Próprias (leitura, campo)
      { userId: carlos.id, areaId: areaObrasProp.id, canWrite: false, isPrimary: false },
      // Marcos → Planejamento (primário, escrita)
      { userId: marcos.id, areaId: areaPlano.id, canWrite: true, isPrimary: true },
      // Lúcia → Equipamentos (primário, escrita)
      { userId: lucia.id, areaId: areaEquip.id, canWrite: true, isPrimary: true },
    ],
  })

  console.log('✅ Escopos de área configurados')

  // ─── CONTRATOS ────────────────────────────────────────────────────────────
  const hoje = new Date()
  const dataInicio = (mesesAtras: number) => {
    const d = new Date(hoje)
    d.setMonth(d.getMonth() - mesesAtras)
    return d
  }
  const dataFim = (mesesFrente: number) => {
    const d = new Date(hoje)
    d.setMonth(d.getMonth() + mesesFrente)
    return d
  }

  const contratos = await Promise.all([
    prisma.contract.create({
      data: {
        areaId: areaObrasProp.id,
        number: 'SAAE-047/2025',
        name: 'Rede de Esgoto — Bairro Central Norte',
        client: 'SAAE Municipal',
        description: 'Implantação de 4,2km de rede coletora de esgoto no Bairro Central Norte, incluindo ligações prediais e poços de visita.',
        estimatedValue: 2340000.00,
        startDate: dataInicio(4),
        endDate: dataFim(6),
        responsibleId: joao.id,
        status: 'at_risk',
        riskNotes: 'Atraso no fornecimento de tubos PVC 200mm. Impacta cronograma de maio.',
      },
    }),
    prisma.contract.create({
      data: {
        areaId: areaObrasProp.id,
        number: 'PMM-012/2025',
        name: 'Ampliação ETA — Módulo B',
        client: 'Prefeitura Municipal',
        description: 'Obras civis para ampliação da Estação de Tratamento de Água, módulo B.',
        estimatedValue: 870000.00,
        startDate: dataInicio(2),
        endDate: dataFim(10),
        responsibleId: joao.id,
        status: 'active',
      },
    }),
    prisma.contract.create({
      data: {
        areaId: areaObrasTerc.id,
        number: 'PMC-023/2025',
        name: 'Pavimentação Av. Central — Trecho 2',
        client: 'Prefeitura Municipal',
        description: 'Pavimentação asfáltica com meio-fio e sarjeta em 1,8km da Av. Central.',
        estimatedValue: 1560000.00,
        startDate: dataInicio(6),
        endDate: dataFim(2),
        responsibleId: ana.id,
        status: 'delayed',
        riskNotes: 'Equipe do contratado reduzida. Atraso de 18 dias no cronograma base.',
      },
    }),
    prisma.contract.create({
      data: {
        areaId: areaObrasTerc.id,
        number: 'SAAE-051/2025',
        name: 'Manutenção Rede de Água — Zona Sul',
        client: 'SAAE Municipal',
        description: 'Serviços de manutenção preventiva e corretiva na rede de distribuição de água da Zona Sul.',
        estimatedValue: 420000.00,
        startDate: dataInicio(3),
        endDate: dataFim(9),
        responsibleId: ana.id,
        status: 'active',
      },
    }),
  ])

  const [cSaae047, cPmm012, cPmc023, cSaae051] = contratos
  console.log('✅ 4 contratos criados')

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  const diasAtras = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
  }

  // Report 1 — Obras Próprias, semana atual, publicado, crítico
  const report1 = await prisma.report.create({
    data: {
      areaId: areaObrasProp.id,
      contractId: cSaae047.id,
      authorId: joao.id,
      title: 'Semana 19/2026 — Obras Próprias',
      period: 'Semana 19/2026',
      status: 'published',
      executiveSummary: 'Semana de avanço moderado no contrato SAAE-047. A equipe executou 73% do previsto no trecho norte, mas o fornecimento de tubos PVC criou risco real de paralisação para a próxima semana. O contrato PMM-012 segue sem intercorrências.',
      evolutions: '• Conclusão da escavação do trecho 4A — 320m lineares\n• Equipe 2 realocada para o setor norte após conclusão do trecho sul\n• Vistoria da fiscalização realizada sem pendências registradas\n• Medição parcial de abril encaminhada à SAAE para aprovação',
      criticalPoints: '• ATRASO NO FORNECIMENTO: Tubos PVC 200mm com prazo original em 08/05 não foram entregues. Fornecedor informou novo prazo para 15/05. Se não confirmado até quinta, há risco de paralisação da equipe na semana 20.\n• MEDIÇÃO BLOQUEADA: Medição de abril (R$ 312.000) depende de aditivo contratual ainda não assinado pela SAAE.',
      attentionPoints: '• Dois afastamentos médicos na equipe — operador de retroescavadeira e servente\n• Prazo do contrato: 174 dias restantes com 42% de execução física',
      risks: '• Risco de paralisação de equipe por falta de material (impacto: 5-7 dias de atraso)\n• Risco de inadimplência temporária caso medição de abril não seja aprovada até 20/05',
      blockers: '• Assinatura do aditivo contratual pela SAAE (enviado protocolo 2026/1847 em 03/05)',
      decisionsNeeded: '• Autorização para contatar fornecedor alternativo de tubos PVC caso entrega não ocorra até 15/05\n• Orientação sobre estratégia de cobrança do aditivo junto à SAAE',
      nextSteps: '• Confirmar entrega de material com fornecedor até 10/05\n• Reagendar vistoria do trecho 5 para após chegada dos tubos\n• Acompanhar tramitação do aditivo na SAAE',
      pendingItems: '• E-mail de confirmação do novo prazo do fornecedor (solicitado pela diretoria)\n• Relatório fotográfico do trecho 4A concluído',
      agendaSuggestion: 'Estratégia de fornecimento de tubos PVC — risco de paralisação | Cobrança do aditivo SAAE-047',
      hasCritical: true,
      hasDecisionNeeded: true,
      publishedAt: diasAtras(2),
    },
  })

  // Report 2 — Obras Próprias, semana anterior
  const report2 = await prisma.report.create({
    data: {
      areaId: areaObrasProp.id,
      contractId: cSaae047.id,
      authorId: joao.id,
      title: 'Semana 18/2026 — Obras Próprias',
      period: 'Semana 18/2026',
      status: 'published',
      executiveSummary: 'Boa semana operacional. Conclusão do trecho sul conforme cronograma. Aditivo contratual enviado para assinatura da SAAE.',
      evolutions: '• Conclusão do trecho sul: 680m lineares executados\n• Aditivo contratual enviado por protocolo em 03/05\n• Recebimento de EPI para equipe campo',
      criticalPoints: '• Nenhum ponto crítico nesta semana',
      attentionPoints: '• Fornecedor sinalizou possível dificuldade de entrega de tubos para semana 19',
      hasCritical: false,
      hasDecisionNeeded: false,
      publishedAt: diasAtras(9),
    },
  })

  // Report 3 — Obras Terceirizadas, desatualizado (8 dias atrás)
  const report3 = await prisma.report.create({
    data: {
      areaId: areaObrasTerc.id,
      contractId: cPmc023.id,
      authorId: ana.id,
      title: 'Semana 18/2026 — Obras Terceirizadas',
      period: 'Semana 18/2026',
      status: 'published',
      executiveSummary: 'Semana difícil no contrato PMC-023. Contratada operando com equipe reduzida. Atraso de 18 dias acumulado.',
      evolutions: '• Execução de 280m de pavimentação no trecho norte\n• Reunião com contratada para cobrança de reforço de equipe',
      criticalPoints: '• Contratada com 40% da equipe prevista em contrato. Justificativa: conflito com outra obra.',
      attentionPoints: '• Prazo do contrato: 2 meses restantes com 32% de atraso acumulado',
      decisionsNeeded: '• Aplicar multa contratual? Notificação formal pendente de orientação da diretoria',
      hasCritical: true,
      hasDecisionNeeded: true,
      publishedAt: diasAtras(8),
    },
  })

  // Report 4 — SESMT, recente
  const report4 = await prisma.report.create({
    data: {
      areaId: areaSesmt.id,
      authorId: carlos.id,
      title: 'Semana 19/2026 — SESMT e Logística',
      period: 'Semana 19/2026',
      status: 'published',
      executiveSummary: 'Distribuição de EPI concluída. Dois afastamentos médicos registrados. Treinamento de altura previsto para semana 20.',
      evolutions: '• Distribuição de 45 kits de EPI para equipes campo\n• DDS realizados em todos os canteiros\n• NR-35 agendada para 20/05 — 28 colaboradores',
      attentionPoints: '• Dois afastamentos médicos em Obras Próprias impactam cronograma\n• Estoque de capacete atingiu nível mínimo',
      pendingItems: '• Renovação do contrato com clínica médica (vence 30/05)\n• Reposição de capacetes: pedido emitido, prazo de entrega 3 dias úteis',
      hasCritical: false,
      hasDecisionNeeded: false,
      publishedAt: diasAtras(3),
    },
  })

  // Report 5 — Planejamento, rascunho
  const report5 = await prisma.report.create({
    data: {
      areaId: areaPlano.id,
      authorId: marcos.id,
      title: 'Semana 19/2026 — Planejamento',
      period: 'Semana 19/2026',
      status: 'draft',
      executiveSummary: 'Revisão do cronograma geral Q3 em andamento.',
      hasCritical: false,
      hasDecisionNeeded: false,
    },
  })

  console.log('✅ 5 reports criados (4 publicados, 1 rascunho)')

  // ─── DEMANDAS ─────────────────────────────────────────────────────────────
  const diasFrente = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d
  }

  const dem1 = await prisma.demand.create({
    data: {
      areaId: areaObrasProp.id,
      contractId: cSaae047.id,
      reportId: report2.id,
      title: 'Regularização do aditivo contratual SAAE-047',
      context: 'O aditivo foi enviado por protocolo (2026/1847) em 03/05. Sem assinatura, a medição de abril (R$ 312.000) fica bloqueada. Risco de fluxo de caixa.',
      responsibleId: joao.id,
      createdById: ridson.id,
      status: 'in_progress',
      priority: 'critical',
      dueDate: diasAtras(6),  // VENCIDA
      blockers: 'Aguarda assinatura do diretor jurídico da SAAE',
      origin: 'director',
      isOverdue: true,
    },
  })

  const dem2 = await prisma.demand.create({
    data: {
      areaId: areaSesmt.id,
      title: 'Reposição de EPI — equipe norte (capacetes e luvas)',
      context: 'Estoque de capacetes atingiu nível crítico. Equipe norte com 6 colaboradores sem capacete reserva. NR-6 exige reposição imediata.',
      responsibleId: carlos.id,
      createdById: ridson.id,
      status: 'pending',
      priority: 'critical',
      dueDate: diasFrente(2),
      origin: 'director',
    },
  })

  const dem3 = await prisma.demand.create({
    data: {
      areaId: areaObrasTerc.id,
      contractId: cPmc023.id,
      reportId: report3.id,
      title: 'Notificação formal à contratada PMC-023 por redução de equipe',
      context: 'Contratada operando com 40% da equipe prevista. Acúmulo de 18 dias de atraso. Decisão sobre notificação formal e possível multa contratual.',
      responsibleId: ana.id,
      createdById: ridson.id,
      status: 'pending',
      priority: 'high',
      dueDate: diasFrente(4),
      supportNeeded: 'Orientação jurídica sobre aplicação de multa contratual',
      origin: 'director',
    },
  })

  const dem4 = await prisma.demand.create({
    data: {
      areaId: areaObrasProp.id,
      contractId: cSaae047.id,
      reportId: report1.id,
      title: 'Confirmar entrega de tubos PVC 200mm — fornecedor principal',
      context: 'Fornecedor confirmou novo prazo para 15/05. Preciso de confirmação formal por e-mail até 10/05. Se não confirmar, acionar fornecedor alternativo.',
      responsibleId: joao.id,
      createdById: ridson.id,
      status: 'in_progress',
      priority: 'high',
      dueDate: diasFrente(1),
      origin: 'report',
    },
  })

  const dem5 = await prisma.demand.create({
    data: {
      areaId: areaObrasProp.id,
      contractId: cPmm012.id,
      title: 'Levantamento de quantitativos ETA Módulo B',
      context: 'Necessário levantamento dos quantitativos de concreto e armação para elaboração do cronograma físico-financeiro.',
      responsibleId: joao.id,
      createdById: marcos.id,
      status: 'in_progress',
      priority: 'medium',
      dueDate: diasFrente(14),
      origin: 'manager',
    },
  })

  const dem6 = await prisma.demand.create({
    data: {
      areaId: areaSesmt.id,
      title: 'Renovação contrato clínica médica — vence 30/05',
      context: 'Contrato com clínica parceira (exames admissionais e periódicos) vence em 30/05. Necessário cotação e renovação com antecedência.',
      responsibleId: carlos.id,
      createdById: carlos.id,
      status: 'pending',
      priority: 'medium',
      dueDate: diasFrente(19),
      origin: 'manager',
    },
  })

  const dem7 = await prisma.demand.create({
    data: {
      areaId: areaObrasTerc.id,
      contractId: cSaae051.id,
      title: 'Relatório de medição mensal SAAE-051 — maio',
      context: 'Relatório de medição de maio do contrato SAAE-051 deve ser entregue até 20/05 para faturamento.',
      responsibleId: ana.id,
      createdById: ana.id,
      status: 'in_progress',
      priority: 'medium',
      dueDate: diasFrente(9),
      origin: 'manager',
    },
  })

  const dem8 = await prisma.demand.create({
    data: {
      areaId: areaEquip.id,
      title: 'Vistoria retroescavadeira #12 — manutenção preventiva',
      context: 'Retroescavadeira #12 com 2.100h de operação. Manutenção preventiva prevista em contrato a cada 2.000h. Necessária parada programada.',
      responsibleId: lucia.id,
      createdById: lucia.id,
      status: 'pending',
      priority: 'medium',
      dueDate: diasFrente(7),
      origin: 'manager',
    },
  })

  console.log('✅ 8 demandas criadas')

  // ─── HISTÓRICO DE DEMANDAS ────────────────────────────────────────────────
  await prisma.demandUpdate.createMany({
    data: [
      {
        demandId: dem1.id,
        authorId: joao.id,
        content: 'Entrei em contato com o fiscal da SAAE (Carlos Mendonça). Informou que o aditivo está na mesa do diretor jurídico aguardando assinatura. Novo prazo estimado: 14/05.',
        statusBefore: 'pending',
        statusAfter: 'in_progress',
        createdAt: diasAtras(1),
      },
      {
        demandId: dem1.id,
        authorId: joao.id,
        content: 'Documento enviado por protocolo em 03/05. Número de protocolo: 2026/1847. Aguardando retorno da SAAE.',
        createdAt: diasAtras(7),
      },
      {
        demandId: dem4.id,
        authorId: joao.id,
        content: 'Liguei para o representante do fornecedor. Confirmou verbalmente que entrega ocorre em 15/05. Solicitei confirmação por e-mail.',
        createdAt: diasAtras(1),
      },
      {
        demandId: dem5.id,
        authorId: joao.id,
        content: 'Iniciado levantamento na planta executiva. Estimativa: 3 dias para conclusão do quantitativo de concreto. Armação na semana seguinte.',
        statusBefore: 'pending',
        statusAfter: 'in_progress',
        createdAt: diasAtras(2),
      },
    ],
  })

  console.log('✅ Histórico de demandas criado')

  // ─── COMENTÁRIOS DA DIRETORIA ─────────────────────────────────────────────
  const com1 = await prisma.comment.create({
    data: {
      objectType: 'report',
      objectId: report1.id,
      authorId: ridson.id,
      type: 'follow_up',
      content: 'João, sobre o atraso do fornecedor de tubos: já acionou o fornecedor B? Qual o prazo de entrega alternativo? Preciso de retorno até amanhã às 12h para decidir se acionamos ou não.',
      dueDate: new Date(),
      createdAt: diasAtras(2),
    },
  })

  // Resposta do João
  await prisma.comment.create({
    data: {
      objectType: 'report',
      objectId: report1.id,
      parentId: com1.id,
      authorId: joao.id,
      type: 'observation',
      content: 'Sim, já contatei o fornecedor B (Tubos Sul). Prazo deles: 12 dias úteis a partir do pedido. Aguardando proposta formal de preço. Envio assim que receber.',
      createdAt: diasAtras(1),
    },
  })

  const com2 = await prisma.comment.create({
    data: {
      objectType: 'report',
      objectId: report1.id,
      authorId: ridson.id,
      type: 'evidence_request',
      content: 'Preciso do e-mail do fornecedor original informando o novo prazo de entrega (15/05). Isso é necessário para documentar o risco no relatório de andamento.',
      dueDate: new Date(),
      createdAt: diasAtras(2),
    },
  })

  // Comentário no relatório de Obras Terceirizadas
  const com3 = await prisma.comment.create({
    data: {
      objectType: 'report',
      objectId: report3.id,
      authorId: ridson.id,
      type: 'follow_up',
      content: 'Ana, este relatório está com 8 dias sem atualização. Preciso de update desta semana urgente. O status do PMC-023 é o mais crítico do portfólio agora.',
      dueDate: diasFrente(1),
      createdAt: new Date(),
    },
  })

  // Comentário em demanda
  await prisma.comment.create({
    data: {
      objectType: 'demand',
      objectId: dem1.id,
      authorId: ridson.id,
      type: 'follow_up',
      content: 'João, essa demanda está vencida há 6 dias. O que mais posso fazer para ajudar a destravar na SAAE? Posso ligar diretamente para o diretor deles se necessário.',
      dueDate: diasFrente(1),
      createdAt: diasAtras(1),
    },
  })

  console.log('✅ Comentários e interações criados')

  // ─── SOLICITAÇÕES DE EVIDÊNCIA ────────────────────────────────────────────
  await prisma.evidenceRequest.create({
    data: {
      objectType: 'report',
      objectId: report1.id,
      commentId: com2.id,
      requestedById: ridson.id,
      responsibleId: joao.id,
      description: 'E-mail do fornecedor de tubos PVC confirmando o novo prazo de entrega (15/05/2026)',
      dueDate: new Date(),
      status: 'pending',
      createdAt: diasAtras(2),
    },
  })

  await prisma.evidenceRequest.create({
    data: {
      objectType: 'report',
      objectId: report4.id,
      requestedById: ridson.id,
      responsibleId: carlos.id,
      description: 'Fotos da distribuição de EPI para a equipe norte — semana 19',
      dueDate: diasFrente(3),
      status: 'pending',
      createdAt: diasAtras(1),
    },
  })

  console.log('✅ Solicitações de evidência criadas')

  // ─── PAUTA DE REUNIÃO ─────────────────────────────────────────────────────
  const agenda = await prisma.meetingAgenda.create({
    data: {
      title: 'Reuniao de Acompanhamento Semanal - 14/05/2026',
      meetingDate: diasFrente(3),
      createdById: ridson.id,
      status: 'preparing',
      notes: 'Reuniao ordinaria de acompanhamento. Presenca obrigatoria de todos os gestores.',
    },
  })

  await prisma.agendaItem.createMany({
    data: [
      {
        agendaId: agenda.id,
        order: 1,
        title: 'SAAE-047 - Risco de paralisacao por falta de tubos PVC',
        description: 'Fornecedor com prazo critico para 15/05. Decisao necessaria: acionar fornecedor alternativo?',
        origin: 'report',
        reportId: report1.id,
        status: 'pending',
      },
      {
        agendaId: agenda.id,
        order: 2,
        title: 'SAAE-047 - Cobranca do aditivo contratual',
        description: 'Medicao de abril (R$ 312k) bloqueada. Demanda vencida ha 6 dias.',
        origin: 'demand',
        demandId: dem1.id,
        status: 'pending',
      },
      {
        agendaId: agenda.id,
        order: 3,
        title: 'PMC-023 - Contratada com equipe reduzida: notificacao ou multa?',
        description: '18 dias de atraso acumulado. Orientacao juridica necessaria.',
        origin: 'demand',
        demandId: dem3.id,
        status: 'pending',
      },
      {
        agendaId: agenda.id,
        order: 4,
        title: 'Reposicao de EPI - equipe norte',
        description: 'Demanda critica com prazo em 2 dias.',
        origin: 'demand',
        demandId: dem2.id,
        status: 'pending',
      },
    ],
  })

  console.log('Pauta de reuniao criada com 4 itens')

  // ─── NOTIFICAÇÕES ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: ridson.id,
        type: 'report_published',
        title: 'Novo report publicado',
        body: 'João Ferreira publicou: Semana 19/2026 — Obras Próprias',
        objectType: 'report',
        objectId: report1.id,
        isRead: false,
        createdAt: diasAtras(2),
      },
      {
        userId: ridson.id,
        type: 'report_published',
        title: 'Novo report publicado',
        body: 'Carlos Silva publicou: Semana 19/2026 — SESMT e Logística',
        objectType: 'report',
        objectId: report4.id,
        isRead: false,
        createdAt: diasAtras(3),
      },
      {
        userId: ridson.id,
        type: 'demand_overdue',
        title: 'Demanda vencida',
        body: 'Regularização do aditivo contratual SAAE-047 está vencida há 6 dias',
        objectType: 'demand',
        objectId: dem1.id,
        isRead: false,
        createdAt: diasAtras(1),
      },
      {
        userId: joao.id,
        type: 'follow_up',
        title: 'Cobrança da diretoria',
        body: 'Ridson Lima cobrou retorno sobre o aditivo SAAE-047',
        objectType: 'demand',
        objectId: dem1.id,
        isRead: false,
        createdAt: diasAtras(1),
      },
      {
        userId: joao.id,
        type: 'evidence_requested',
        title: 'Evidência solicitada',
        body: 'Ridson Lima solicitou: E-mail do fornecedor confirmando novo prazo',
        objectType: 'report',
        objectId: report1.id,
        isRead: false,
        createdAt: diasAtras(2),
      },
      {
        userId: carlos.id,
        type: 'demand_assigned',
        title: 'Nova demanda atribuída',
        body: 'Ridson Lima atribuiu: Reposição de EPI — equipe norte',
        objectType: 'demand',
        objectId: dem2.id,
        isRead: false,
        createdAt: diasAtras(2),
      },
      {
        userId: ana.id,
        type: 'follow_up',
        title: 'Cobrança da diretoria',
        body: 'Ridson Lima: "Este relatório está com 8 dias sem atualização..."',
        objectType: 'report',
        objectId: report3.id,
        isRead: false,
        createdAt: new Date(),
      },
    ],
  })

  console.log('✅ Notificações criadas')

  // ─── RESUMO FINAL ─────────────────────────────────────────────────────────
  console.log('\n✨ Seed concluído com sucesso!\n')
  console.log('═══════════════════════════════════════════')
  console.log('  USUÁRIOS DE ACESSO (senha: gtec@2026)')
  console.log('═══════════════════════════════════════════')
  console.log('  ridsonlima@gmail.com     → Diretor Técnico')
  console.log('  joao.ferreira@empresa.com → Gestor — Obras Próprias')
  console.log('  ana.costa@empresa.com     → Gestor — Obras Terceirizadas')
  console.log('  carlos.silva@empresa.com  → Supervisor — SESMT')
  console.log('  marcos.pereira@empresa.com→ Gestor — Planejamento')
  console.log('  lucia.ramos@empresa.com   → Supervisor — Equipamentos')
  console.log('  admin@empresa.com         → Administrador')
  console.log('═══════════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
