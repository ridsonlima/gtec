import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDirector } from '@/lib/permissions'
import { periodKey, type Frequencia } from '@/lib/rotinaPeriodo'
import { RotinasClient } from './RotinasClient'

export const dynamic = 'force-dynamic'

export default async function RotinasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const canManage = ['master', 'admin', 'director', 'manager', 'supervisor'].includes(session.user.role)
  const verTudo = isDirector(session.user.role)

  const areas = verTudo
    ? await prisma.area.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
    : await prisma.area.findMany({
        where: { id: { in: session.user.areaScopes.map((s) => s.areaId) }, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })

  // Panorama da diretoria (read-only): por área, quantas rotinas e quantas feitas no ciclo.
  let overview: { areaId: string; name: string; total: number; feitas: number; ultima: string | null }[] | null = null
  if (verTudo) {
    const rotinas = await prisma.rotinaArea.findMany({ where: { ativo: true }, select: { id: true, areaId: true, frequencia: true } })
    const periodos = Array.from(new Set(rotinas.map((r) => periodKey(r.frequencia as Frequencia))))
    const conclusoes = periodos.length
      ? await prisma.rotinaConclusao.findMany({
          where: { rotinaId: { in: rotinas.map((r) => r.id) }, periodo: { in: periodos } },
          select: { rotinaId: true, periodo: true, concluidoEm: true },
        })
      : []
    const done = new Set(conclusoes.map((c) => `${c.rotinaId}|${c.periodo}`))
    const rotinaArea = new Map(rotinas.map((r) => [r.id, r.areaId]))
    const ultimaPorArea = new Map<string, Date>()
    for (const c of conclusoes) {
      const aId = rotinaArea.get(c.rotinaId)
      if (!aId) continue
      const cur = ultimaPorArea.get(aId)
      if (!cur || c.concluidoEm > cur) ultimaPorArea.set(aId, c.concluidoEm)
    }
    const byArea = new Map<string, { total: number; feitas: number }>()
    for (const r of rotinas) {
      const acc = byArea.get(r.areaId) ?? { total: 0, feitas: 0 }
      acc.total++
      if (done.has(`${r.id}|${periodKey(r.frequencia as Frequencia)}`)) acc.feitas++
      byArea.set(r.areaId, acc)
    }
    overview = areas
      .map((a) => ({
        areaId: a.id,
        name: a.name,
        total: byArea.get(a.id)?.total ?? 0,
        feitas: byArea.get(a.id)?.feitas ?? 0,
        ultima: ultimaPorArea.get(a.id)?.toISOString() ?? null,
      }))
      .filter((o) => o.total > 0)
  }

  return <RotinasClient areas={areas} canManage={canManage} overview={overview} />
}
