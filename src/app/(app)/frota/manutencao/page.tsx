import { ManutencaoListView } from '@/components/frota/ManutencaoListView'

type SP = { status?: string; tipo?: string }

export default function FrotaManutencaoPage({ searchParams }: { searchParams: SP }) {
  return <ManutencaoListView tipo="veiculo" searchParams={searchParams} />
}
