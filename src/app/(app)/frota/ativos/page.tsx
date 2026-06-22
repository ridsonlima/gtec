import { AtivosListView } from '@/components/frota/AtivosListView'

type SP = { status?: string; search?: string }

export default function FrotaAtivosPage({ searchParams }: { searchParams: SP }) {
  return <AtivosListView tipo="veiculo" searchParams={searchParams} />
}
