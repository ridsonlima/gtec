import { AuditoriasListView } from '@/components/frota/AuditoriasListView'

type SP = { status?: string; contratoId?: string }

export default function FrotaAuditoriasPage({ searchParams }: { searchParams: SP }) {
  return <AuditoriasListView tipo="veiculo" searchParams={searchParams} />
}
