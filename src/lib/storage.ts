import { put, del, list } from '@vercel/blob'

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
]

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Faz upload de um arquivo para o Vercel Blob.
 * Retorna a storageKey (URL pública do blob).
 */
export async function uploadFile(
  buffer: Buffer,
  storageKey: string,
  mimeType: string
): Promise<string> {
  const blob = await put(storageKey, buffer, {
    access: 'public',
    contentType: mimeType,
  })

  return blob.url
}

/**
 * Retorna a URL de download do arquivo.
 * Se storageKey já for uma URL completa (novos uploads), retorna diretamente.
 * Se for um path relativo (registros legados), resolve via Vercel Blob list().
 */
export async function getSignedUrl(
  storageKey: string,
  _expiresInSeconds = 3600
): Promise<string> {
  // Novos registros já guardam a URL completa
  if (storageKey.startsWith('https://') || storageKey.startsWith('http://')) {
    return storageKey
  }
  // Registros legados guardam o path — busca a URL real no Blob
  const { blobs } = await list({ prefix: storageKey, limit: 1 })
  if (blobs.length > 0) return blobs[0].url
  // Fallback: retorna o que tiver (vai falhar mas com mensagem mais clara)
  return storageKey
}

/**
 * Remove um arquivo do Vercel Blob.
 * Aceita tanto URL completa quanto path legado.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith('https://') || storageKey.startsWith('http://')) {
    await del(storageKey)
    return
  }
  // Path legado: resolve a URL real antes de deletar
  const { blobs } = await list({ prefix: storageKey, limit: 1 })
  if (blobs.length > 0) await del(blobs[0].url)
}

/**
 * Gera a storageKey para um arquivo.
 * Formato: {objectType}/{objectId}/{uuid}-{sanitizedFileName}
 */
export function generateStorageKey(
  objectType: string,
  objectId: string,
  originalName: string
): string {
  const uuid = crypto.randomUUID()
  const sanitized = originalName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
  return `${objectType}/${objectId}/${uuid}-${sanitized}`
}
