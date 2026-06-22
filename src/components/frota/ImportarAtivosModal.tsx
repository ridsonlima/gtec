'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

interface AtivoImport {
  tag: string; tipo: string; categoria: string; descricao: string
  marca: string | null; modelo: string | null; anoFabricacao: number | null
  placa: string | null; numeroserie: string | null; valorLocacaoMensal: number
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function parseNum(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(n)) return n
    const n2 = Number(v); return isNaN(n2) ? 0 : n2
  }
  return 0
}
function parseAno(v: unknown): number | null {
  const n = Math.trunc(Number(v))
  return n > 1900 && n < 2100 ? n : null
}

const VEIC = ['caminh', 'veiculo', 'caminhonete', 'onibus', 'motocicl', 'trator', 'retro', 'escavad', 'pa carreg', 'motonivel', 'rolo compact', 'blindado']

export function ImportarAtivosModal({ tipoInicial, onClose }: { tipoInicial: 'equipamento' | 'veiculo'; onClose: () => void }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<'equipamento' | 'veiculo'>(tipoInicial)
  const [parsing, setParsing] = useState(false)
  const [registros, setRegistros] = useState<AtivoImport[]>([])
  const [fileName, setFileName] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ inseridos: number; atualizados: number; erros: any[] } | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setErro(''); setResultado(null); setRegistros([]); setFileName(file.name)
    setParsing(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      // Mapa de categoria pela aba "Resumo" (se houver)
      const resumoName = wb.SheetNames.find((n) => /resumo/i.test(n))
      const catByTag: Record<number, string> = {}
      if (resumoName) {
        const rr = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[resumoName], { header: 1, defval: null })
        let cur: string | null = null
        for (const r of rr) {
          const c0 = r[0], c1 = r[1], c2 = r[2]
          const s0 = String(c0 ?? '').trim()
          if (s0 && !/categoria|descri|resumo/i.test(s0) && c1 != null && c2 != null) {
            const q = Number(c1), p = Number(c2)
            if (isFinite(q) && isFinite(p) && p <= 1.01 && q >= 1) { cur = s0; continue }
          }
          if (cur && c1 != null) { const t = Number(c1); if (Number.isInteger(t)) catByTag[t] = cur }
        }
      }

      // Aba principal
      const mainName = wb.SheetNames.find((n) => /cadastro|equipa|veic|frota|ativo/i.test(n))
        ?? wb.SheetNames.find((n) => !/resumo|dados orig/i.test(n)) ?? wb.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[mainName], { header: 1, defval: null })

      // Localiza a linha de cabeçalho (precisa de uma coluna tag/pat e uma descrição)
      let headerIdx = -1
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const cells = rows[i].map(norm)
        const hasTag = cells.some((c) => /\btag\b|pat|patrim/.test(c))
        const hasDesc = cells.some((c) => /descri/.test(c))
        if (hasTag && hasDesc) { headerIdx = i; break }
      }
      if (headerIdx < 0) throw new Error('Não encontrei o cabeçalho (preciso de colunas TAG/PAT e Descrição).')

      const header = rows[headerIdx].map(norm)
      const col = (re: RegExp) => header.findIndex((h) => re.test(h))
      const idx = {
        tag: col(/\btag\b|pat|patrim/),
        desc: col(/descri/),
        marca: col(/marca/),
        modelo: col(/modelo/),
        ano: col(/\bano\b/),
        serie: col(/serie|chassi/),
        placa: col(/placa/),
        valor: col(/valor|loca/),
        categoria: col(/categoria/),
        tipo: col(/\btipo\b/),
      }

      const out: AtivoImport[] = []
      const seen = new Set<string>()
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i]
        const rawTag = idx.tag >= 0 ? r[idx.tag] : null
        const descRaw = idx.desc >= 0 ? r[idx.desc] : null
        const descricao = descRaw != null ? String(descRaw).trim() : ''
        if (rawTag == null && !descricao) continue
        const tagStr = String(rawTag ?? '').trim()
        if (!tagStr || /total geral/i.test(tagStr)) continue

        const patNum = Number(tagStr)
        const isInt = Number.isInteger(patNum) && tagStr !== ''
        const tag = isInt ? `PAT-${patNum}` : tagStr.toUpperCase()
        if (!descricao && !isInt) continue
        if (seen.has(tag)) continue
        seen.add(tag)

        // tipo: coluna explícita > seleção do usuário (com override por palavra-chave p/ veículo)
        let tp: 'equipamento' | 'veiculo' = tipo
        if (idx.tipo >= 0 && r[idx.tipo]) {
          tp = /veic|carro|caminh|frota/.test(norm(r[idx.tipo])) ? 'veiculo' : 'equipamento'
        } else if (VEIC.some((k) => norm(descricao).includes(k))) {
          tp = 'veiculo'
        }

        const categoria = idx.categoria >= 0 && r[idx.categoria]
          ? String(r[idx.categoria]).trim()
          : (isInt ? (catByTag[patNum] ?? 'Outros Equipamentos') : 'Outros Equipamentos')

        out.push({
          tag,
          tipo: tp,
          categoria,
          descricao: descricao || tagStr,
          marca: idx.marca >= 0 && r[idx.marca] ? String(r[idx.marca]).trim() : null,
          modelo: idx.modelo >= 0 && r[idx.modelo] ? String(r[idx.modelo]).trim() : null,
          anoFabricacao: idx.ano >= 0 ? parseAno(r[idx.ano]) : null,
          placa: idx.placa >= 0 && r[idx.placa] ? String(r[idx.placa]).trim() : null,
          numeroserie: idx.serie >= 0 && r[idx.serie] ? String(r[idx.serie]).trim() : null,
          valorLocacaoMensal: idx.valor >= 0 ? Math.round(parseNum(r[idx.valor]) * 100) / 100 : 0,
        })
      }
      if (out.length === 0) throw new Error('Nenhuma linha válida encontrada na planilha.')
      setRegistros(out)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ler a planilha.')
    } finally {
      setParsing(false)
    }
  }

  async function enviar() {
    setEnviando(true); setErro('')
    try {
      const res = await fetch('/api/frota/ativos/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativos: registros }),
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? 'Erro ao importar')
      setResultado(json.data)
      qc.invalidateQueries({ queryKey: ['ativos'] })
      qc.invalidateQueries({ queryKey: ['frota'] })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao importar')
    } finally {
      setEnviando(false)
    }
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Importar planilha</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {resultado ? (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <p className="text-lg font-bold text-gray-900">Importação concluída</p>
              <p className="text-sm text-gray-600">
                {resultado.inseridos} novo(s) · {resultado.atualizados} atualizado(s)
                {resultado.erros.length > 0 && <> · <span className="text-red-600">{resultado.erros.length} erro(s)</span></>}
              </p>
              <button onClick={onClose} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Fechar</button>
            </div>
          ) : (
            <>
              {/* Tipo */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Esta planilha é de:</span>
                {(['equipamento', 'veiculo'] as const).map((t) => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${tipo === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t === 'equipamento' ? 'Equipamentos' : 'Veículos'}
                  </button>
                ))}
              </div>

              {/* Upload */}
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
              >
                {parsing ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Lendo planilha…</div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">{fileName || 'Clique para escolher o arquivo'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">.xlsx, .xls ou .csv</p>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>

              {erro && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {erro}
                </div>
              )}

              {/* Preview */}
              {registros.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {registros.length} item(ns) lido(s) — pré-visualização:
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50"><tr className="text-gray-500">
                        <th className="text-left font-semibold px-2 py-1.5">TAG</th>
                        <th className="text-left font-semibold px-2 py-1.5">Descrição</th>
                        <th className="text-left font-semibold px-2 py-1.5">Categoria</th>
                        <th className="text-left font-semibold px-2 py-1.5">Marca</th>
                        {tipo === 'veiculo' && <th className="text-left font-semibold px-2 py-1.5">Placa</th>}
                        <th className="text-right font-semibold px-2 py-1.5">Valor/mês</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {registros.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 font-mono text-gray-700">{r.tag}</td>
                            <td className="px-2 py-1 text-gray-800">{r.descricao}</td>
                            <td className="px-2 py-1 text-gray-500">{r.categoria}</td>
                            <td className="px-2 py-1 text-gray-500">{r.marca ?? '—'}</td>
                            {tipo === 'veiculo' && <td className="px-2 py-1 text-gray-500">{r.placa ?? '—'}</td>}
                            <td className="px-2 py-1 text-right text-gray-700">{fmtBRL(r.valorLocacaoMensal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {registros.length > 50 && <p className="text-xs text-gray-400">… e mais {registros.length - 50} item(ns).</p>}

                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button onClick={enviar} disabled={enviando}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Importar {registros.length} item(ns)
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400">
                A importação atualiza itens existentes pela <strong>TAG</strong> e adiciona os novos (não duplica).
                Números puros viram <code>PAT-9</code>; a categoria é lida da aba “Resumo por Categoria” quando existir.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
