'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderKanban, Plus, X, Loader2, ChevronRight } from 'lucide-react'

interface Projeto {
  id: string; name: string; objective: string | null; status: string
  startDate: string | null; expectedEndDate: string | null
  responsibleUser: { id: string; name: string }
}
interface Usuario { id: string; name: string }

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  planned:     { label: 'Planejado',   cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'Em execução', cls: 'bg-blue-50 text-blue-700' },
  completed:   { label: 'Concluído',   cls: 'bg-green-50 text-green-700' },
  cancelled:   { label: 'Cancelado',   cls: 'bg-red-50 text-red-700' },
}

export function ContratoProjetos({ contractId, defaultResponsavelId, canManage }: {
  contractId: string; defaultResponsavelId?: string; canManage: boolean
}) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [responsavelId, setResponsavelId] = useState(defaultResponsavelId ?? '')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [erro, setErro] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['projetos-contrato', contractId], queryFn: () => fetch(`/api/projects?contractId=${contractId}`).then((r) => r.json()) })
  const projetos: Projeto[] = data?.data ?? []

  const { data: usersData } = useQuery({ queryKey: ['users-list'], queryFn: () => fetch('/api/users').then((r) => r.json()), enabled: showForm })
  const usuarios: Usuario[] = usersData?.data ?? usersData ?? []

  const createM = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome.trim(), objective: objetivo.trim() || null, contractId, responsibleId: responsavelId,
          startDate: inicio || null, expectedEndDate: fim || null,
        }),
      })
      const j = await res.json(); if (!res.ok) throw new Error(j.error ?? 'Erro')
    },
    onSuccess: () => { setShowForm(false); setNome(''); setObjetivo(''); setInicio(''); setFim(''); qc.invalidateQueries({ queryKey: ['projetos-contrato', contractId] }) },
    onError: (e: any) => setErro(e.message),
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FolderKanban className="w-4 h-4" /> Projetos da obra
          <span className="text-xs font-normal text-gray-400">({projetos.length})</span>
        </h2>
        {canManage && !showForm && (
          <button onClick={() => { setShowForm(true); setErro('') }} className="inline-flex items-center gap-1 text-xs font-medium text-white bg-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> Novo projeto
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 -mt-1">Um contrato (guarda-chuva) pode ter vários projetos/obras. Os projetos aparecem na alocação da Rental.</p>

      {showForm && (
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="pinput" placeholder="Nome do projeto / obra *" autoFocus />
          <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="pinput" placeholder="Objetivo (opcional)" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs text-gray-600 space-y-1"><span>Responsável *</span>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="pinput">
                <option value="">Selecione…</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Início</span><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="pinput" /></label>
            <label className="block text-xs text-gray-600 space-y-1"><span>Previsão de término</span><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="pinput" /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancelar</button>
            <button onClick={() => createM.mutate()} disabled={createM.isPending || nome.trim().length < 3 || !responsavelId} className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Cadastrar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : projetos.length === 0 ? (
        !showForm && <p className="text-sm text-gray-400 py-2">Nenhum projeto cadastrado nesta obra.</p>
      ) : (
        <div className="space-y-2">
          {projetos.map((p) => {
            const meta = STATUS_LABEL[p.status] ?? STATUS_LABEL.planned
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} className="flex items-center gap-3 border border-gray-100 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{p.responsibleUser?.name}{p.expectedEndDate && ` · prev. ${new Date(p.expectedEndDate).toLocaleDateString('pt-BR')}`}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      <style jsx global>{`
        .pinput { width: 100%; font-size: 0.875rem; border: 1px solid rgb(229 231 235); border-radius: 0.5rem; padding: 0.45rem 0.7rem; background: white; }
        .pinput:focus { outline: none; box-shadow: 0 0 0 2px rgb(147 197 253); }
      `}</style>
    </div>
  )
}
