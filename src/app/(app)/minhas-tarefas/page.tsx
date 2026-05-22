import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CheckSquare } from 'lucide-react'
import { TarefasBoard } from '@/components/tarefas/TarefasBoard'

export default async function MinhasTarefasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const tarefas = await prisma.tarefaPessoal.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: 'asc' }, { prazo: 'asc' }, { createdAt: 'desc' }],
  })

  // Serializa datas para props de client component
  const tarefasSerial = tarefas.map((t) => ({
    id:          t.id,
    titulo:      t.titulo,
    descricao:   t.descricao,
    status:      t.status,
    prioridade:  t.prioridade,
    categoria:   t.categoria,
    prazo:       t.prazo?.toISOString() ?? null,
    concluidaEm: t.concluidaEm?.toISOString() ?? null,
    createdAt:   t.createdAt.toISOString(),
    updatedAt:   t.updatedAt.toISOString(),
  }))

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-blue-500" />
          Minhas Tarefas
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gerencie suas atividades pessoais — visíveis somente por você.
        </p>
      </div>

      <TarefasBoard initialTarefas={tarefasSerial} />
    </div>
  )
}
