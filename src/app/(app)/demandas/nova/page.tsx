'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, AlertCircle, Users, X, ArrowRightLeft } from 'lucide-react'

interface DemandFormData {
  areaId: string
  requestingAreaId: string
  contractId: string
  title: string
  context: string
  priority: string
  origin: string
  responsibleId: string
  dueDate: string
  reportId: string
}

const EMPTY: DemandFormData = {
  areaId: '', requestingAreaId: '', contractId: '', title: '', context: '',
  priority: 'medium', origin: 'director', responsibleId: '', dueDate: '', reportId: '',
}

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

const ORIGIN_OPTIONS = [
  { value: 'director', label: 'Diretoria' },
  { value: 'manager', label: 'Coordenação' },
  { value: 'interarea', label: 'Solicitação Interárea' },
  { value: 'report', label: 'Report' },
  { value: 'contract', label: 'Contrato' },
  { value: 'audit', label: 'Auditoria' },
  { value: 'other', label: 'Outro' },
]

type UserOption = { id: string; name: string; role: string }

export default function NovaDemandaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const preAreaId = searchParams.get('areaId') ?? ''
  const preReportId = searchParams.get('reportId') ?? ''

  const [form, setForm] = useState<DemandFormData>({
    ...EMPTY,
    areaId: preAreaId,
    reportId: preReportId,
    origin: preReportId ? 'report' : 'director',
  })
  const [isInterArea, setIsInterArea] = useState(false)
  const [collaborators, setCollaborators] = useState<UserOption[]>([])
  const [collaboratorSearch, setCollaboratorSearch] = useState('')
  const [showCollabDropdown, setShowCollabDropdown] = useState(false)
  const [error, setError] = useState('')
  const collabRef = useRef<HTMLDivElement>(null)

  const set = (key: keyof DemandFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const { data: areasData } = useQuery({ queryKey: ['areas'], queryFn: () => fetch('/api/areas').then((r) => r.json()) })
  const { data: contractsData } = useQuery({
    queryKey: ['contracts', form.areaId],
    queryFn: () => fetch(`/api/contracts?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId),
  })

  // Responsável: se interárea usa busca global, senão lista da área executora
  const { data: usersAreaData } = useQuery({
    queryKey: ['users-area', form.areaId],
    queryFn: () => fetch(`/api/users?areaId=${form.areaId}`).then((r) => r.json()),
    enabled: Boolean(form.areaId) && !isInterArea,
  })
  const { data: collabSearchData } = useQuery({
    queryKey: ['users-search', collaboratorSearch],
    queryFn: () => fetch(`/api/users/search?q=${encodeURIComponent(collaboratorSearch)}`).then((r) => r.json()),
    enabled: collaboratorSearch.length >= 2,
  })

  // Busca de responsável em modo interárea
  const [responsibleSearch, setResponsibleSearch] = useState('')
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  const [selectedResponsible, setSelectedResponsible] = useState<UserOption | null>(null)
  const responsibleRef = useRef<HTMLDivElement>(null)

  const { data: responsibleSearchData } = useQuery({
    queryKey: ['users-search-resp', responsibleSearch],
    queryFn: () => fetch(`/api/users/search?q=${encodeURIComponent(responsibleSearch)}`).then((r) => r.json()),
    enabled: isInterArea && responsibleSearch.length >= 2,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (collabRef.current && !collabRef.current.contains(e.target as Node)) {
        setShowCollabDropdown(false)
      }
      if (responsibleRef.current && !responsibleRef.current.contains(e.target as Node)) {
        setShowResponsibleDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const areas = areasData?.data ?? []
  const contracts = contractsData?.data ?? []
  const usersArea: UserOption[] = usersAreaData?.data ?? []
  const collabResults: UserOption[] = collabSearchData?.data ?? []
  const responsibleResults: UserOption[] = responsibleSearchData?.data ?? []

  function addCollaborator(user: UserOption) {
    if (!collaborators.find((c) => c.id === user.id)) {
      setCollaborators((prev) => [...prev, user])
    }
    setCollaboratorSearch('')
    setShowCollabDropdown(false)
  }

  function removeCollaborator(id: string) {
    setCollaborators((prev) => prev.filter((c) => c.id !== id))
  }

  function handleInterAreaToggle(checked: boolean) {
    setIsInterArea(checked)
    setForm((f) => ({
      ...f,
      origin: checked ? 'interarea' : 'director',
      requestingAreaId: '',
      responsibleId: '',
    }))
    setSelectedResponsible(null)
    setResponsibleSearch('')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Título obrigatório')
      if (!form.areaId) throw new Error('Selecione a área executora')
      if (isInterArea && !form.requestingAreaId) throw new Error('Selecione a área solicitante')
      if (isInterArea && form.requestingAreaId === form.areaId) throw new Error('Área solicitante deve ser diferente da executora')
      if (!form.responsibleId) throw new Error('Selecione um responsável')
      if (!form.dueDate) throw new Error('Informe o prazo')

      const res = await fetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          requestingAreaId: isInterArea ? form.requestingAreaId : null,
          contractId: form.contractId || null,
          reportId: form.reportId || null,
          collaboratorIds: collaborators.map((c) => c.id),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar demanda')
      return json.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['demands'] })
      router.push(`/demandas/${data.id}`)
    },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nova Demanda</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registre uma demanda de acompanhamento para uma área ou entre áreas.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Toggle Interárea */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isInterArea}
            onChange={(e) => handleInterAreaToggle(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-800">
              <ArrowRightLeft className="w-4 h-4" />
              Demanda Interárea
            </div>
            <p className="text-xs text-blue-600 mt-0.5">
              Uma área solicita que outra área execute esta demanda.
            </p>
          </div>
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

        {/* Áreas */}
        <div className={`grid gap-4 ${isInterArea ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <Field label={isInterArea ? 'Área Executora' : 'Área'} required>
            <select
              value={form.areaId}
              onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, contractId: '', responsibleId: '' }))}
              className="input"
            >
              <option value="">Selecione a área...</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          {isInterArea && (
            <Field label="Área Solicitante" required>
              <select
                value={form.requestingAreaId}
                onChange={set('requestingAreaId')}
                className="input"
              >
                <option value="">Selecione a área...</option>
                {areas
                  .filter((a: any) => a.id !== form.areaId)
                  .map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {!isInterArea && (
          <Field label="Contrato (opcional)">
            <select value={form.contractId} onChange={set('contractId')} disabled={!form.areaId} className="input disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">Sem contrato específico</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.number} - {c.name}</option>)}
            </select>
            {form.areaId && contracts.length === 0 && (
              <Link href={`/contratos/novo?areaId=${form.areaId}`} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                Nenhum contrato nesta área. Cadastrar contrato
              </Link>
            )}
          </Field>
        )}

        <Field label="Título" required>
          <input type="text" value={form.title} onChange={set('title')} placeholder="Ex: Apresentar cronograma atualizado da obra" className="input" />
        </Field>

        <Field label="Contexto / descrição (opcional)">
          <textarea rows={3} value={form.context} onChange={set('context')} placeholder="Detalhe o que precisa ser feito, contexto e critério de conclusão." className="input resize-y" />
        </Field>

        {/* Responsável */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Responsável" required>
            {isInterArea ? (
              <div ref={responsibleRef} className="relative">
                <input
                  type="text"
                  placeholder={selectedResponsible ? selectedResponsible.name : 'Buscar responsável...'}
                  value={selectedResponsible ? selectedResponsible.name : responsibleSearch}
                  onChange={(e) => { setResponsibleSearch(e.target.value); setSelectedResponsible(null); setForm(f => ({ ...f, responsibleId: '' })); setShowResponsibleDropdown(true) }}
                  onFocus={() => setShowResponsibleDropdown(true)}
                  className={`input ${selectedResponsible ? 'text-gray-800' : ''}`}
                  disabled={!form.areaId}
                />
                {showResponsibleDropdown && responsibleResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {responsibleResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                        onMouseDown={() => {
                          setSelectedResponsible(u)
                          setForm(f => ({ ...f, responsibleId: u.id }))
                          setShowResponsibleDropdown(false)
                          setResponsibleSearch('')
                        }}
                      >
                        <span className="font-medium">{u.name}</span>
                        <span className="text-xs text-gray-400">({u.role})</span>
                      </button>
                    ))}
                  </div>
                )}
                {responsibleSearch.length >= 2 && responsibleResults.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhum usuário encontrado</p>
                )}
              </div>
            ) : (
              <select value={form.responsibleId} onChange={set('responsibleId')} disabled={!form.areaId} className="input disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">{form.areaId ? 'Selecione o responsável...' : 'Selecione uma área primeiro'}</option>
                {usersArea.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            )}
          </Field>

          <Field label="Prazo" required>
            <input type="date" value={form.dueDate} onChange={set('dueDate')} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prioridade">
            <select value={form.priority} onChange={set('priority')} className="input">
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Origem">
            <select value={form.origin} onChange={set('origin')} className="input">
              {ORIGIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {preReportId && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
            Esta demanda será vinculada ao report que a originou.
          </div>
        )}
      </div>

      {/* Colaboradores */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Colaboradores (opcional)</h3>
        </div>
        <p className="text-xs text-gray-400">
          Adicione pessoas que precisam acompanhar ou contribuir com esta demanda, independente da área.
        </p>

        {collaborators.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {collaborators.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2.5 py-1 rounded-full">
                {c.name}
                <button type="button" onClick={() => removeCollaborator(c.id)} className="hover:text-red-600 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div ref={collabRef} className="relative">
          <input
            type="text"
            placeholder="Buscar pessoa para adicionar..."
            value={collaboratorSearch}
            onChange={(e) => { setCollaboratorSearch(e.target.value); setShowCollabDropdown(true) }}
            onFocus={() => setShowCollabDropdown(true)}
            className="input"
          />
          {showCollabDropdown && collabResults.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {collabResults
                .filter((u) => !collaborators.find((c) => c.id === u.id))
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                    onMouseDown={() => addCollaborator(u)}
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-gray-400">({u.role})</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending
            ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            : <Save className="w-4 h-4" />}
          Criar Demanda
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 space-y-1">
      <span>{label} {required && <span className="text-red-500">*</span>}</span>
      {children}
    </label>
  )
}
