import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isManagerOrAbove, getUserAreaIds } from '@/lib/permissions'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { getAusenciasMap } from '@/lib/ausencias'
import { SubstituicaoBadge } from '@/components/shared/SubstituicaoBadge'
import { ListChecks, AlertTriangle, Clock, Camera, Megaphone, User, Layers, ChevronRight } from 'lucide-react'

type SP = { group?: string }

export default async function PendenciasPage({ searchParams }: { searchParams: SP }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isManagerOrAbove(session.user.role)) redirect('/dashboard')

  const group = searchParams.group === 'area' ? 'area' : 'responsavel'
  const areaIds = getUserAreaIds(session) // null = vê tudo (diretor)
  const demandAreaFilter = areaIds ? { areaId: { in: areaIds } } : {}

  const [demandas, evidencias, comunicados] = await Promise.all([
    prisma.demand.findMany({
      where: { status: { notIn: ['completed', 'cancelled'] }, ...demandAreaFilter },
      select: {
        id: true, title: true, isOverdue: true, dueDate: true, priority: true,
        responsible: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
    }),
    prisma.evidenceRequest.findMany({
      where: { status: 'pending' },
      select: {
        id: true, description: true, objectType: true, objectId: true,
        responsible: { select: { id: true, name: true } },
      },
    }),
    prisma.comunicado.findMany({
      where: {
        ativo: true,
        exigeAceite: true,
        ...(areaIds ? { OR: [{ alvoTipo: 'todos' }, { alvoTipo: 'area', alvoAreaId: { in: areaIds } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, prioridade: true, createdAt: true,
        _count: { select: { leituras: { where: { aceiteEm: { not: null } } } } },
      },
    }),
  ])

  // ── Agrupamento ────────────────────────────────────────────────────────────
  type Grupo = {
    chave: string
    nome: string
    vencidas: typeof demandas
    abertas: typeof demandas
    evidencias: typeof evidencias
  }
  const grupos = new Map<string, Grupo>()

  function getGrupo(chave: string, nome: string): Grupo {
    if (!grupos.has(chave)) grupos.set(chave, { chave, nome, vencidas: [], abertas: [], evidencias: [] })
    return grupos.get(chave)!
  }

  for (const d of demandas) {
    const chave = group === 'area' ? (d.area?.id ?? 'sem') : (d.responsible?.id ?? 'sem')
    const nome  = group === 'area' ? (d.area?.name ?? 'Sem área') : (d.responsible?.name ?? 'Sem responsável')
    const g = getGrupo(chave, nome)
    if (d.isOverdue) g.vencidas.push(d)
    else g.abertas.push(d)
  }

  // Evidências só agrupam por responsável (não têm área direta)
  if (group === 'responsavel') {
    for (const e of evidencias) {
      const chave = e.responsible?.id ?? 'sem'
      const nome  = e.responsible?.name ?? 'Sem responsável'
      getGrupo(chave, nome).evidencias.push(e)
    }
  }

  const listaGrupos = Array.from(grupos.values())
    .map((g) => ({ ...g, total: g.vencidas.length + g.abertas.length + g.evidencias.length }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.vencidas.length - a.vencidas.length || b.total - a.total)

  const totalVencidas = demandas.filter((d) => d.isOverdue).length
  const totalAbertas  = demandas.filter((d) => !d.isOverdue).length
  const totalEvid     = evidencias.length
  const comunicadosPendentesGlobal = comunicados.length

  // Substituições: quando agrupado por responsável, sinaliza quem está ausente
  const ausenciasMap = group === 'responsavel'
    ? await getAusenciasMap(listaGrupos.map((g) => g.chave))
    : new Map()

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ListChecks className="w-5 h-5" /> Pendências
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Tudo que está em aberto, num só lugar. Foco no que está parado — não no passo a passo.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Demandas vencidas" value={totalVencidas} cls={totalVencidas > 0 ? 'text-red-600' : 'text-gray-400'} />
        <KpiCard label="Demandas abertas" value={totalAbertas} cls="text-blue-600" />
        <KpiCard label="Evidências pendentes" value={totalEvid} cls={totalEvid > 0 ? 'text-purple-600' : 'text-gray-400'} />
        <KpiCard label="Comunicados s/ ciência total" value={comunicadosPendentesGlobal} cls={comunicadosPendentesGlobal > 0 ? 'text-amber-600' : 'text-gray-400'} />
      </div>

      {/* Toggle de agrupamento */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Agrupar por:</span>
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
          <Link href="/pendencias?group=responsavel" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${group === 'responsavel' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <User className="w-3.5 h-3.5" /> Responsável
          </Link>
          <Link href="/pendencias?group=area" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${group === 'area' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <Layers className="w-3.5 h-3.5" /> Área
          </Link>
        </div>
      </div>

      {/* Comunicados aguardando ciência */}
      {comunicados.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">Comunicados aguardando ciência</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {comunicados.map((c) => (
              <Link key={c.id} href="/comunicados" className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.prioridade === 'urgente' ? 'bg-red-500' : c.prioridade === 'importante' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                <p className="text-sm text-gray-800 flex-1 truncate">{c.title}</p>
                <span className="text-xs text-gray-400">{c._count.leituras} ciente{c._count.leituras !== 1 ? 's' : ''}</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Grupos */}
      {listaGrupos.length === 0 ? (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8 text-center">
          <ListChecks className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-800">Nenhuma pendência em aberto 🎉</p>
          <p className="text-xs text-green-600 mt-0.5">Demandas e evidências estão todas em dia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaGrupos.map((g) => (
            <div key={g.chave} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Cabeçalho do grupo */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {group === 'area' ? <Layers className="w-4 h-4 text-gray-400" /> : <User className="w-4 h-4 text-gray-400" />}
                  <h3 className="text-sm font-semibold text-gray-900">{g.nome}</h3>
                  {ausenciasMap.get(g.chave) && <SubstituicaoBadge info={ausenciasMap.get(g.chave)!} />}
                </div>
                <div className="flex items-center gap-1.5">
                  {g.vencidas.length > 0 && <Chip cls="text-red-700 bg-red-50 border-red-200" icon={AlertTriangle} label={`${g.vencidas.length} vencida${g.vencidas.length > 1 ? 's' : ''}`} />}
                  {g.abertas.length > 0 && <Chip cls="text-blue-700 bg-blue-50 border-blue-200" icon={Clock} label={`${g.abertas.length} aberta${g.abertas.length > 1 ? 's' : ''}`} />}
                  {g.evidencias.length > 0 && <Chip cls="text-purple-700 bg-purple-50 border-purple-200" icon={Camera} label={`${g.evidencias.length} evid.`} />}
                </div>
              </div>

              {/* Itens */}
              <div className="divide-y divide-gray-50">
                {[...g.vencidas, ...g.abertas].slice(0, 8).map((d) => (
                  <Link key={d.id} href={`/demandas/${d.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                    {d.isOverdue && <span className="text-xs font-bold text-red-600 flex-shrink-0">VENCIDA</span>}
                    <p className="text-sm text-gray-800 flex-1 truncate">{d.title}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {group === 'responsavel' ? d.area?.name : d.responsible?.name}
                      {d.dueDate ? ` · ${formatDate(d.dueDate)}` : ''}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
                {g.evidencias.slice(0, 5).map((e) => {
                  const href = e.objectType === 'demand' ? `/demandas/${e.objectId}` : e.objectType === 'contract' ? `/contratos/${e.objectId}` : `/reports/${e.objectId}`
                  return (
                    <Link key={e.id} href={href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                      <Camera className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <p className="text-sm text-gray-700 flex-1 truncate">{e.description}</p>
                      <span className="text-xs text-purple-500 flex-shrink-0">evidência</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </Link>
                  )
                })}
                {[...g.vencidas, ...g.abertas].length > 8 && (
                  <p className="px-5 py-2 text-xs text-gray-400">+ {[...g.vencidas, ...g.abertas].length - 8} outras demandas</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${cls}`}>{value}</p>
    </div>
  )
}

function Chip({ cls, icon: Icon, label }: { cls: string; icon: any; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  )
}
