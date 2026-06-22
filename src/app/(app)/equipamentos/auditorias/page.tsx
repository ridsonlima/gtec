import { AuditoriasListView } from '@/components/frota/AuditoriasListView'

type SP = { status?: string; contratoId?: string }

export default function EquipamentosAuditoriasPage({ searchParams }: { searchParams: SP }) {
  return <AuditoriasListView tipo="equipamento" searchParams={searchParams} />
}
