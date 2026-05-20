'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'

const AREA_SLUG_TO_ID_MAP: Record<string, string> = {
  'sala-tecnica': 'PLAN',
  planejamento: 'PLAN_PLANEJ',
  orcamento: 'PLAN_ORC',
  'obras-proprias': 'OBRAS_PROP',
  'obras-terceirizadas': 'OBRAS_TERC',
  sesmt: 'SESMT',
  equipamentos: 'EQUIP',
}

export default function EditAreaPage() {
  const params = useParams<{ areaId: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '', sortOrder: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['area', params.areaId],
    queryFn: async () => {
      const slug = params.areaId
      const code = AREA_SLUG_TO_ID_MAP[slug]
      if (code) {
        const r = await fetch(`/api/areas`)
        const j = await r.json()
        return { data: (j.data ?? []).find((a: any) => a.code === code) }
      }
      return fetch(`/api/areas/${params.areaId}`).then((r) => r.json())
    },
  })

  const area = data?.data
  useEffect(() => {
    if (!area) return
    setForm({
      name: area.name ?? '',
      description: area.description ?? '',
      sortOrder: String(area.sortOrder ?? 0),
    })
  }, [area])

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!area) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/areas/${area.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        sortOrder: form.sortOrder !== '' ? Number(form.sortOrder) : undefined,
      }),
    })
    const d = await res.json()
    setLoading(false)
    if (!res.ok) { setError(d?.error ?? 'Erro ao salvar'); return }
    router.push(`/areas/${params.areaId}`)
    router.refresh()
  }

  if (isLoading) return <div className="text-sm text-gray-500">Carregando...</div>
  if (!area) return <div className="text-sm text-red-500">Área não encontrada.</div>

  return (
    <div className="max-w-xl space-y-5">
      <Link
        href={`/areas/${params.areaId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para a área
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar área</h1>
        <p className="text-sm text-gray-500 mt-1">Atualize nome, descrição e ordem de exibição.</p>
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 space-y-1">
          <span>Nome da área <span className="text-red-500">*</span></span>
          <input required value={form.name} onChange={set('name')} className="input" />
        </label>

        <label className="block text-sm font-medium text-gray-700 space-y-1">
          <span>Descrição</span>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            className="input resize-y"
            placeholder="Descreva a função e responsabilidades desta área"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700 space-y-1">
          <span>Ordem de exibição</span>
          <input
            type="number"
            min="0"
            value={form.sortOrder}
            onChange={set('sortOrder')}
            className="input"
            placeholder="0"
          />
          <span className="text-xs text-gray-400">Números menores aparecem primeiro no menu</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={`/areas/${params.areaId}`}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
