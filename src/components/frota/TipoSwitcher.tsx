import Link from 'next/link'
import { Truck, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Seletor Veículos | Equipamentos exibido no topo de cada tela do CDG Rental.
 * Mantém o usuário no mesmo "função" (ativos, medicoes, etc.) ao trocar de tipo.
 */
export function TipoSwitcher({ tipo, func }: { tipo: 'veiculo' | 'equipamento'; func: string }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors'
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
      <Link
        href={`/frota/${func}`}
        className={cn(base, tipo === 'veiculo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
      >
        <Truck className="w-3.5 h-3.5" /> Veículos
      </Link>
      <Link
        href={`/equipamentos/${func}`}
        className={cn(base, tipo === 'equipamento' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
      >
        <Package className="w-3.5 h-3.5" /> Equipamentos
      </Link>
    </div>
  )
}
