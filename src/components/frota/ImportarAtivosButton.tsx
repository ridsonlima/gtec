'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet } from 'lucide-react'
import { ImportarAtivosModal } from './ImportarAtivosModal'

export function ImportarAtivosButton({ tipo }: { tipo: 'equipamento' | 'veiculo' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" /> Importar planilha
      </button>
      {open && (
        <ImportarAtivosModal
          tipoInicial={tipo}
          onClose={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
