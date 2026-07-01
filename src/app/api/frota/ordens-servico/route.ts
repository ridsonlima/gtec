import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { createNotification } from '@/lib/notifications'

const INCLUDE_LISTA = {
  ativo: { select: { id: true, tag: true, descricao: true, categoria: true, tipo: true, status: true } },
  createdBy: { select: { id: true, name: true } },
}

// GET /api/frota/ordens-servico
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const { searchParams } = req.nextUrl
  const ativoId = searchParams.get('ativoId')
  const tipo = searchParams.get('tipo')
  const status = searchParams.get('status')
  const vencidas = searchParams.get('vencidas')

  const where: any = {}
  if (ativoId) where.ativoId = ativoId
  if (tipo) where.tipo = tipo
  if (status) where.status = status
  if (vencidas === 'true') {
    where.dataPrevista = { lt: new Date() }
    where.status = { in: ['aberta', 'em_execucao'] }
  }

  const ordens = await prisma.ordemServico.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dataPrevista: 'asc' }, { dataAbertura: 'desc' }],
    include: INCLUDE_LISTA,
  })

  return apiSuccess(ordens)
}

// POST /api/frota/ordens-servico  — abre OS e coloca ativo em manutenção
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!['master', 'admin', 'manager', 'supervisor'].includes(session.user.role))
    return apiError('Sem permissão', 403)

  const body = await req.json()
  const { ativoId, tipo, descricao, dataPrevista, executante, custo, observacoes } = body

  if (!ativoId || !tipo || !descricao)
    return apiError('ativoId, tipo e descricao são obrigatórios', 400)

  const tiposValidos = ['preventiva', 'corretiva']
  if (!tiposValidos.includes(tipo))
    return apiError('tipo deve ser: preventiva | corretiva', 400)

  const ativo = await prisma.ativo.findUnique({
    where: { id: ativoId },
    include: {
      alocacoes: { where: { dataFim: null }, take: 1 },
    },
  })
  if (!ativo) return apiError('Ativo não encontrado', 404)
  if (ativo.status === 'inativo') return apiError('Ativo inativo não pode ter OS aberta', 400)

  // corretiva: encerra alocação ativa e muda status para manutenção
  // preventiva: apenas registra, mantém onde está
  const ops: any[] = []

  if (tipo === 'corretiva' && ativo.alocacoes.length > 0) {
    ops.push(
      prisma.alocacaoAtivo.update({
        where: { id: ativo.alocacoes[0].id },
        data: { dataFim: new Date(), observacoes: `Encerrado por OS corretiva` },
      })
    )
  }

  ops.push(
    prisma.ativo.update({
      where: { id: ativoId },
      data: { status: 'manutencao' },
    })
  )

  const os = await prisma.ordemServico.create({
    data: {
      ativoId,
      tipo,
      descricao,
      status: 'aberta',
      dataAbertura: new Date(),
      dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
      executante: executante || null,
      custo: custo != null ? Number(custo) : null,
      observacoes: observacoes || null,
      createdById: session.user.id,
    },
    include: INCLUDE_LISTA,
  })

  if (ops.length) await prisma.$transaction(ops)

  // notifica gestores sobre corretiva (interrupção de ativo)
  if (tipo === 'corretiva') {
    const gestores = await prisma.user.findMany({
      where: { role: { in: ['master', 'admin', 'director'] }, isActive: true },
      select: { id: true },
    })
    if (gestores.length) {
      await prisma.notification.createMany({
        data: gestores.map((g) => ({
          userId: g.id,
          type: 'os_corretiva_aberta',
          title: `OS corretiva aberta — ${ativo.tag}`,
          body: `${ativo.descricao}: ${descricao}`,
          objectType: 'ordem_servico',
          objectId: os.id,
        })),
        skipDuplicates: true,
      })
    }
  }

  return apiSuccess(os, 201)
}
