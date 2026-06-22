'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'

const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5'
const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

type Contrato = { id: string; number: string; name: string }
type User = { id: string; name: string }

export default function FrotaNovaAuditoriaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])

  const [contratoId, setContratoId]   = useState('')
  const [auditorId, setAuditorId]     = useState('')
  const [dataVisita, setDataVisita]   = useState(new Date().toISOString().slice(0, 10))
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    fetch('/api/contracts?status=active')
      .then((r) => r.json())
      .then((d) => { if (d.data) setContratos(d.data) })
      .catch(() => {})

    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => { if (d.data) setUsuarios(d.data) })
      .catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!auditorId) return setError('Selecione o auditor responsável')
    setError(''); setSaving(true)
    try {
      const res = await fetch('/api/frota/auditorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId: contratoId || null,
          auditorId,
          dataVisita,
          observacoes: observacoes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Erro ao agendar visita')
      router.push(`/frota/auditorias/${data.data.id}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/frota/auditorias" className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" />
          Agendar visita
        </h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className={LABEL}>Contrato (opcional)</label>
          <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={INPUT}>
            <option value="">Sem contrato específico</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>{c.number} — {c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>Auditor responsável *</label>
          <select value={auditorId} onChange={(e) => setAuditorId(e.target.value)} required className={INPUT}>
            <option value="">Selecione…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>Data da visita *</label>
          <input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} required className={INPUT} />
        </div>

        <div>
          <label className={LABEL}>Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Objetivos ou escopo da visita…"
            className={`${INPUT} resize-none`}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Link href="/frota/auditorias" className="px-4 py-2 text-sm text-gray-600">Cancelar</Link>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50">
            {saving ? 'Agendando…' : 'Agendar visita'}
          </button>
        </div>
      </form>
    </div>
  )
}
