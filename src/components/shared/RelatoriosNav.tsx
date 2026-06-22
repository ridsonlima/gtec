import Link from 'next/link'
import { FileBarChart, TrendingUp, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Aba = 'executivo' | 'tendencias' | 'interarea'

const ABAS: { key: Aba; label: string; href: string; icon: any }[] = [
  { key: 'executivo',  label: 'Executivo',  href: '/relatorio-executivo',  icon: FileBarChart },
  { key: 'tendencias', label: 'Tendências', href: '/analytics',            icon: TrendingUp },
  { key: 'interarea',  label: 'Interárea',  href: '/relatorio-interarea',  icon: ArrowRightLeft },
]

/**
 * Barra de abas única dos relatórios executivos.
 * Une as três telas (antes dispersas) numa só superfície oficial.
 */
export function RelatoriosNav({ active }: { active: Aba }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-3">Relatórios Executivos</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {ABAS.map((aba) => {
          const Icon = aba.icon
          const ativo = aba.key === active
          return (
            <Link
              key={aba.key}
              href={aba.href}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                ativo
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              )}
            >
              <Icon className="w-4 h-4" /> {aba.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
