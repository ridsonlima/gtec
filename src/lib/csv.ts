/**
 * Parser de CSV simples e robusto (sem dependência externa).
 * Suporta aspas duplas, vírgulas dentro de aspas e ponto-e-vírgula como separador.
 */
export function parseCsv(text: string): Record<string, string>[] {
  // Remove BOM
  const clean = text.replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  // Detecta separador (vírgula ou ponto-e-vírgula)
  const headerLine = lines[0]
  const sep = (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ';' : ','

  const headers = splitCsvLine(headerLine, sep).map((h) => h.trim().toLowerCase())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i], sep)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === sep && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
