import { MedicoesListView } from '@/components/frota/MedicoesListView'

type SP = { status?: string; contratoId?: string; ano?: string }

export default function EquipamentosMedicoesPage({ searchParams }: { searchParams: SP }) {
  return <MedicoesListView tipo="equipamento" searchParams={searchParams} />
}
