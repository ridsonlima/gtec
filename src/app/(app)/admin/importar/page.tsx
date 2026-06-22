'use client'

import { useState } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tipo = 'usuarios' | 'ativos' | 'contratos'

const MODELOS: Record<Tipo, { titulo: string; colunas: string; exemplo: string; obrigatorios: string }> = {
  usuarios: {
    titulo: 'Usuários',
    colunas: 'nome, email, perfil, senha',
    obrigatorios: 'nome, email (perfil padrão: viewer · senha padrão: cdg@2026)',
    exemplo: 'nome,email,perfil,senha\nJoão Silva,joao@cdg.eng.br,supervisor,senha123\nMaria Souza,maria@cdg.eng.br,manager,',
  },
  ativos: {
    titulo: 'Ativos (Frota/Equipamentos)',
    colunas: 'tag, tipo, descricao, categoria, marca, modelo, placa, valor',
    obrigatorios: 'tag, tipo (veiculo/equipamento), descricao, valor',
    exemplo: 'tag,tipo,descricao,categoria,marca,modelo,placa,valor\nVEI-001,veiculo,Caminhão basculante,Caminhão,Volvo,FH540,ABC1D23,4500\nEQP-010,equipamento,Escavadeira hidráulica,Escavadeira,CAT,320D,,8000',
  },
  contratos: {
    titulo: 'Contratos',
    colunas: 'numero, nome, cliente, area, valor',
    obrigatorios: 'numero, nome, cliente, area (código ou nome da área)',
    exemplo: 'numero,nome,cliente,area,valor\nCDG-001/2026,Pavimentação Trecho 1,Prefeitura X,OBRAS,1500000\nCDG-002/2026,Manutenção viária,DER,OBRAS,800000',
  },
}

export default function ImportarPage() {
  const [tipo, setTipo] = useState<Tipo>('ativos')
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState('')

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => setCsv((e.target?.result as string) ?? '')
    reader.readAsText(file, 'UTF-8')
  }

  function baixarModelo() {
    const blob = new Blob(['﻿' + MODELOS[tipo].exemplo], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modelo-${tipo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importar() {
    if (!csv.trim()) { setError('Selecione um arquivo CSV ou cole o conteúdo'); return }
    setLoading(true); setError(''); setResultado(null)
    try {
      const res = await fetch('/api/admin/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, csv }),
      })
      const data = await res.json()
      if (!res.ok || data?.success === false) { setError(data?.error ?? 'Erro na importação'); return }
      setResultado(data.data)
    } finally { setLoading(false) }
  }

  const modelo = MODELOS[tipo]
  const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" /> Importação em massa
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Suba uma planilha CSV para cadastrar vários registros de uma vez. Ideal para o onboarding.</p>
      </div>

      {/* Seleção de tipo */}
      <div className="flex gap-2">
        {(['ativos', 'usuarios', 'contratos'] as Tipo[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTipo(t); setResultado(null); setError('') }}
            className={cn('px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              tipo === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}
          >
            {MODELOS[t].titulo}
          </button>
        ))}
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium text-blue-900">Colunas aceitas para {modelo.titulo}:</p>
        <p className="text-xs text-blue-700 font-mono">{modelo.colunas}</p>
        <p className="text-xs text-blue-600">Obrigatórios: {modelo.obrigatorios}</p>
        <button onClick={baixarModelo} className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium hover:underline mt-1">
          <Download className="w-3.5 h-3.5" /> Baixar modelo de exemplo (.csv)
        </button>
      </div>

      {/* Upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Arquivo CSV</span>
          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> Selecionar arquivo
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
          </div>
        </label>

        <div>
          <span className="text-xs text-gray-400">Ou cole o conteúdo do CSV aqui:</span>
          <textarea
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setFileName('') }}
            rows={5}
            placeholder={modelo.exemplo}
            className={`${INPUT} font-mono text-xs mt-1`}
          />
        </div>

        {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {error}</p>}

        <button
          onClick={importar}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {loading ? 'Importando…' : `Importar ${modelo.titulo}`}
        </button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 grid grid-cols-4 gap-3 text-center">
            <div><p className="text-2xl font-bold text-gray-900">{resultado.total}</p><p className="text-xs text-gray-400">Linhas</p></div>
            <div><p className="text-2xl font-bold text-green-600">{resultado.criados}</p><p className="text-xs text-gray-400">Criados</p></div>
            <div><p className="text-2xl font-bold text-amber-600">{resultado.ignorados}</p><p className="text-xs text-gray-400">Ignorados</p></div>
            <div><p className="text-2xl font-bold text-red-600">{resultado.erros}</p><p className="text-xs text-gray-400">Erros</p></div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {resultado.resultados.map((r: any, i: number) => (
              <div key={i} className="px-5 py-2 flex items-center gap-3 text-sm">
                {r.status === 'criado' ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : r.status === 'ignorado' ? <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                <span className="text-gray-400 w-12 flex-shrink-0">L{r.linha}</span>
                {r.chave && <span className="font-medium text-gray-700 flex-shrink-0">{r.chave}</span>}
                <span className={cn('text-xs', r.status === 'erro' ? 'text-red-600' : r.status === 'ignorado' ? 'text-amber-600' : 'text-gray-500')}>{r.mensagem}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
