import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'
import { canAccessArea, canManageRotina } from '@/lib/permissions'
import { periodKey, periodEnd, periodLabel, type Frequencia } from '@/lib/rotinaPeriodo'

const FREQS = ['diaria', 'semanal', 'mensal']

// GET /api/rotinas?areaId=&escopo=minhas|todas
// Retorna cada rotina com a OCORRÊNCIA do ciclo atual (estado/prazo/status) e o
// logbook (registros) desse ciclo. Se o ciclo atual ainda não foi materializado
// (cron não rodou), devolve uma ocorrência sintética "aberta" (id=null).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  const areaId = req.nextUrl.searchParams.get('areaId')
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)

  const podeVerTodas = canManageRotina(session.user.role)
  const escopo = req.nextUrl.searchParams.get('escopo') === 'todas' && podeVerTodas ? 'todas' : 'minhas'

  const rotinas = await prisma.rotinaArea.findMany({
    where: { areaId, ativo: true, ...(escopo === 'minhas' ? { responsavelId: session.user.id } : {}) },
    orderBy: [{ frequencia: 'asc' }, { createdAt: 'asc' }],
  })
  if (rotinas.length === 0) return apiSuccess([])

  // ciclo atual de cada rotina
  const pkByRotina = new Map(rotinas.map((r) => [r.id, periodKey(r.frequencia as Frequencia)]))

  // ocorrências do ciclo atual já materializadas
  const ocorrencias = await prisma.rotinaOcorrencia.findMany({
    where: { rotinaId: { in: rotinas.map((r) => r.id) }, periodo: { in: Array.from(new Set(pkByRotina.values())) } },
  })
  const ocByKey = new Map(ocorrencias.map((o) => [`${o.rotinaId}|${o.periodo}`, o]))

  // registros (logbook) do ciclo atual + anexos
  const ocIds = ocorrencias.map((o) => o.id)
  const registros = ocIds.length
    ? await prisma.rotinaRegistro.findMany({ where: { ocorrenciaId: { in: ocIds } }, orderBy: { createdAt: 'asc' } })
    : []
  const regByOc = new Map<string, typeof registros>()
  for (const rg of registros) {
    const list = regByOc.get(rg.ocorrenciaId) ?? []
    list.push(rg)
    regByOc.set(rg.ocorrenciaId, list)
  }

  const regIds = registros.map((r) => r.id)
  const anexos = regIds.length
    ? await prisma.attachment.findMany({
        where: { objectType: 'rotina_registro', objectId: { in: regIds } },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      })
    : []
  const anexosByReg = new Map<string, any[]>()
  for (const a of anexos) {
    const list = anexosByReg.get(a.objectId) ?? []
    list.push(a)
    anexosByReg.set(a.objectId, list)
  }

  // nomes de usuários (responsáveis + autores + quem fechou)
  const userIds = new Set<string>()
  rotinas.forEach((r) => userIds.add(r.responsavelId))
  registros.forEach((r) => userIds.add(r.autorId))
  ocorrencias.forEach((o) => { if (o.fechadoPorId) userIds.add(o.fechadoPorId) })
  const users = await prisma.user.findMany({ where: { id: { in: Array.from(userIds) } }, select: { id: true, name: true } })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  const result = rotinas.map((r) => {
    const freq = r.frequencia as Frequencia
    const periodo = pkByRotina.get(r.id)!
    const oc = ocByKey.get(`${r.id}|${periodo}`)
    const regs = oc ? (regByOc.get(oc.id) ?? []) : []

    return {
      id: r.id,
      title: r.title,
      descricao: r.descricao,
      instrucoes: r.instrucoes,
      frequencia: r.frequencia,
      cicloLabel: periodLabel(freq),
      responsavel: { id: r.responsavelId, name: userMap.get(r.responsavelId) ?? '—' },
      ehMinha: r.responsavelId === session.user.id,
      ocorrencia: {
        id: oc?.id ?? null,
        periodo,
        prazo: oc?.prazo ?? periodEnd(freq, periodo),
        estado: oc?.estado ?? 'aberta',
        statusFechamento: oc?.statusFechamento ?? null,
        resumo: oc?.resumo ?? null,
        fechadoEm: oc?.fechadoEm ?? null,
        fechadoPor: oc?.fechadoPorId ? (userMap.get(oc.fechadoPorId) ?? '—') : null,
        registros: regs.map((rg) => ({
          id: rg.id,
          texto: rg.texto,
          autor: userMap.get(rg.autorId) ?? '—',
          createdAt: rg.createdAt,
          anexos: anexosByReg.get(rg.id) ?? [],
        })),
      },
    }
  })

  return apiSuccess(result)
}

// POST /api/rotinas — líder cria e atribui a rotina a um usuário
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)
  if (!canManageRotina(session.user.role)) return apiError('Sem permissão', 403)

  const body = await req.json()
  const { areaId, title, descricao, instrucoes, frequencia = 'semanal', responsavelId } = body
  if (!areaId) return apiError('areaId obrigatório', 400)
  if (!canAccessArea(session, areaId)) return apiError('Sem acesso', 403)
  if (!title?.trim()) return apiError('Título obrigatório', 400)
  if (!responsavelId) return apiError('Selecione o responsável', 400)
  if (!FREQS.includes(frequencia)) return apiError('Frequência inválida', 400)

  const rotina = await prisma.rotinaArea.create({
    data: {
      areaId,
      responsavelId,
      title: title.trim(),
      descricao: descricao?.trim() || null,
      instrucoes: instrucoes?.trim() || null,
      frequencia,
      createdById: session.user.id,
    },
  })
  return apiSuccess(rotina, 201)
}
