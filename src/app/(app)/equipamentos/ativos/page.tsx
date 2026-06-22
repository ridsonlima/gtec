import { AtivosListView } from '@/components/frota/AtivosListView'

type SP = { status?: string; search?: string }

export default function EquipamentosAtivosPage({ searchParams }: { searchParams: SP }) {
  return <AtivosListView tipo="equipamento" searchParams={searchParams} />
}
