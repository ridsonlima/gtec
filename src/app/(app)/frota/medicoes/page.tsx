import { MedicoesListView } from '@/components/frota/MedicoesListView'

type SP = { status?: string; contratoId?: string; ano?: string }

export default function FrotaMedicoesPage({ searchParams }: { searchParams: SP }) {
  return <MedicoesListView tipo="veiculo" searchParams={searchParams} />
}
