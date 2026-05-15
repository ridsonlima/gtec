'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200
                 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
    >
      <Printer className="w-4 h-4" />
      Imprimir / PDF
    </button>
  )
}
