import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'

export default async function AuditPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!['master', 'admin', 'director'].includes(session.user.role)) redirect('/dashboard')

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  })

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoria</h1>
        <p className="text-sm text-gray-500 mt-1">?ltimas movimenta??es registradas no sistema.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Nenhum registro de auditoria encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">A??o</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Objeto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3"><div className="font-medium text-gray-800">{log.user.name}</div><div className="text-xs text-gray-400">{log.user.email}</div></td>
                  <td className="px-4 py-3 font-medium text-gray-800">{log.action}</td>
                  <td className="px-4 py-3 text-gray-500">{log.objectType ?? '-'} {log.objectId ? `#${log.objectId.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-md truncate">{log.metadata ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
