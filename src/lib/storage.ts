import { createClient } from '@supabase/supabase-js'

// Client com service role — apenas server-side
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'gtec-attachments'

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
 * Faz upload de um arquivo para o Supabase Storage.
 * Retorna a storageKey (caminho no bucket).
 */
export async function uploadFile(
  buffer: Buffer,
  storageKey: string,
  mimeType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Falha no upload: ${error.message}`)
  }

  return storageKey
}

/**
 * Gera uma URL pré-assinada para download (expira em 1h por padrão).
 */
export async function getSignedUrl(
  storageKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error(`Falha ao gerar URL: ${error?.message}`)
  }

  return data.signedUrl
}

/**
 * Remove um arquivo do storage.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storageKey])

  if (error) {
    throw new Error(`Falha ao deletar arquivo: ${error.message}`)
  }
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
