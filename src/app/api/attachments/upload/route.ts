import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/lib/auth'
import { apiError } from '@/types/api'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/storage'

/**
 * POST /api/attachments/upload
 *
 * Endpoint usado pelo @vercel/blob/client `upload()` para:
 *  1. Gerar o token de upload direto (browser → Blob Storage, sem passar pela função)
 *  2. Receber o webhook de conclusão do Vercel Blob (onUploadCompleted)
 *
 * O arquivo NÃO passa pela função serverless — vai direto do browser para o Vercel Blob.
 * Isso resolve o limite de 4,5 MB nas funções serverless.
 *
 * Após o `upload()` resolver no cliente, o cliente chama POST /api/attachments
 * para salvar o registro no banco e receber o objeto Attachment de volta.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const userId = session.user.id

  try {
    const body = (await req.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request: req,

      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {}
        const { mimeType, sizeBytes } = payload

        if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
          throw new Error(`Tipo de arquivo não permitido: ${mimeType}`)
        }
        if (sizeBytes && Number(sizeBytes) > MAX_FILE_SIZE) {
          throw new Error('Arquivo muito grande. Limite: 50 MB')
        }

        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({ userId }),
        }
      },

      // O banco é salvo pelo cliente após o upload (via POST /api/attachments)
      onUploadCompleted: async ({ blob }) => {
        console.log('[blob uploaded]', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    console.error('[POST /api/attachments/upload]', msg)
    return apiError(msg, 400)
  }
}
