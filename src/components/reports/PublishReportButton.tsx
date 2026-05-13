'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'

interface Props {
  reportId: string
  areaId: string
}

export function PublishReportButton({ reportId, areaId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePublish() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/${reportId}/publish`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Erro ao publicar report')
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handlePublish}
        disabled={loading}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
        Publicar
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
