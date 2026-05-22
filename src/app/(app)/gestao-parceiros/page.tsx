import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAreaIds } from '@/lib/permissions'
import { Handshake } from 'lucide-react'
import { GestaoParceirosDashboard } from '@/components/gestao-parceiros/GestaoParceirosDashboard'

export default async function GestaoParceirosPage() {
  const session = await auth()
  if (!session) return null

  const allowedAreaIds = getUserAreaIds(session)

  const contracts = await prisma.contract.findMany({
    where: {
      executionModality: 'partner',
      ...(allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}),
    },
    include: {
      area: { select: { id: true, name: true } },
      contractPartners: {
        include: {
          empresaParceira: { select: { id: true, name: true, cnpj: true } },
          instrumentos: { select: { tipo: true, percentage: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      medicoes: {
        orderBy: [{ competenciaAno: 'asc' }, { competenciaMes: 'asc' }],
        include: { adiantamentos: { select: { valor: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Serialize — strip Date objects, keep only what the dashboard needs
  const data = contracts.map((c) => ({
    id: c.id,
    number: c.number,
    name: c.name,
    status: c.status,
    area: c.area,
    contractPartners: c.contractPartners.map((cp) => ({
      id: cp.id,
      percentageTotal: cp.percentageTotal,
      empresaParceira: cp.empresaParceira,
      instrumentos: cp.instrumentos,
    })),
    medicoes: c.medicoes.map((m) => ({
      id: m.id,
      contractPartnerId: m.contractPartnerId,
      competenciaAno: m.competenciaAno,
      competenciaMes: m.competenciaMes,
      valorProduzido: m.valorProduzido,
      valorAprovado: m.valorAprovado,
      valorFaturado: m.valorFaturado,
      adiantamentos: m.adiantamentos,
    })),
  }))

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Handshake className="w-6 h-6 text-blue-600" />
          Gestão de Parceiros
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {contracts.length} contrato{contracts.length !== 1 ? 's' : ''} com parceiro
        </p>
      </div>

      <GestaoParceirosDashboard contracts={data} />
    </div>
  )
}
