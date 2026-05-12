import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessArea } from '@/lib/permissions'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { ChevronLeft, History } from 'lucide-react'

export default async function ReportVersionsPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) return null

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, areaId: true },
  })

  if (!report) notFound()
  if (!canAccessArea(session, report.areaId)) notFound()

  const versions = await prisma.reportVersion.findMany({
    where: { reportId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { savedBy: { select: { id: true, name: true } } },
  })

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href={`/reports/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
      >
        <ChevronLeft className="w-4 h-4" />
        {report.title}
      </Link>

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-500" />
          Histórico de Versões
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {versions.length} versão{versions.length !== 1 ? 'ões' : ''} salva{versions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nenhuma versão anterior registrada
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-3">
            {versions.map((v, idx) => (
              <div key={v.id} className="relative flex gap-5 pl-12">
                <div className="absolute left-4 top-3.5 w-3 h-3 rounded-full bg-gray-300 border-2 border-white" />
                <div className="flex-1 bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Versão {versions.length - idx}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Salvo por {v.savedBy.name} · {formatDateTime(v.createdAt)}
                      </p>
                    </div>
                    {idx === 0 && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        Mais recente
                      </span>
                    )}
                  </div>
                  {/* Could add a "restore" action here in V2 */}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
