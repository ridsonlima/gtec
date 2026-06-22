'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import { CondutoresManager } from './CondutoresManager'

export function CondutoresButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 active:scale-[0.98]"
      >
        <Users className="w-4 h-4" /> Condutores
      </button>
      {open && <CondutoresManager onClose={() => setOpen(false)} />}
    </>
  )
}
