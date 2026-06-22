import { ManutencaoListView } from '@/components/frota/ManutencaoListView'

type SP = { status?: string; tipo?: string }

export default function EquipamentosManutencaoPage({ searchParams }: { searchParams: SP }) {
  return <ManutencaoListView tipo="equipamento" searchParams={searchParams} />
}
