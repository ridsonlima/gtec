'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { Paperclip, Upload, Trash2, Download, X, AlertCircle } from 'lucide-react'
import { formatFileSize, timeAgo } from '@/lib/utils'

const FILE_META: Record<string, { label: string; cls: string }> = {
  'application/pdf':                                                                        { label: 'PDF', cls: 'bg-red-100 text-red-700' },
  'image/jpeg':                                                                             { label: 'IMG', cls: 'bg-purple-100 text-purple-700' },
  'image/png':                                                                              { label: 'IMG', cls: 'bg-purple-100 text-purple-700' },
  'image/webp':                                                                             { label: 'IMG', cls: 'bg-purple-100 text-purple-700' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':                     { label: 'XLS', cls: 'bg-green-100 text-green-700' },
  'application/vnd.ms-excel':                                                               { label: 'XLS', cls: 'bg-green-100 text-green-700' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':               { label: 'DOC', cls: 'bg-blue-100 text-blue-700' },
  'application/msword':                                                                     { label: 'DOC', cls: 'bg-blue-100 text-blue-700' },
  'application/zip':                                                                        { label: 'ZIP', cls: 'bg-gray-100 text-gray-600' },
  'application/x-zip-compressed':                                                          { label: 'ZIP', cls: 'bg-gray-100 text-gray-600' },
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp',
  'application/zip', 'application/x-zip-compressed',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip'

type Attachment = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number | bigint
  createdAt: Date | string
  uploadedBy: { id: string; name: string }
}

type UploadEntry = { tempId: string; name: string; size: number; progress: number }

interface Props {
  initialAttachments: Attachment[]
  objectType: string
  objectId: string
  canUpload: boolean
  currentUserId: string
  canDeleteAll?: boolean
  evidenceRequestId?: string
}

export function AttachmentsPanel({
  initialAttachments,
  objectType,
  objectId,
  canUpload,
  currentUserId,
  canDeleteAll = false,
  evidenceRequestId,
}: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments)
  const [uploading, setUploading]     = useState<UploadEntry[]>([])
  const [deleting, setDeleting]       = useState<Set<string>>(new Set())
  const [error, setError]             = useState('')
  const [dragging, setDragging]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    setError('')
    const list = Array.from(files)

    for (const file of list) {
      // Validações no cliente (antes mesmo de iniciar)
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Tipo não permitido: ${file.name}`)
        continue
      }
      if (file.size > MAX_SIZE) {
        setError(`Arquivo muito grande (máx. 50 MB): ${file.name}`)
        continue
      }

      const tempId = crypto.randomUUID()
      setUploading((prev) => [...prev, { tempId, name: file.name, size: file.size, progress: 0 }])

      try {
        // 1. Upload direto para o Vercel Blob — NÃO passa pela função serverless
        //    Isso resolve o limite de 4,5 MB da função
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/attachments/upload',
          clientPayload: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
          multipart: file.size > 5 * 1024 * 1024, // usa multipart para arquivos > 5 MB
          onUploadProgress: ({ percentage }) => {
            setUploading((prev) =>
              prev.map((u) => u.tempId === tempId ? { ...u, progress: percentage } : u)
            )
          },
        })

        // 2. Salva o registro no banco com a URL do blob
        const res = await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl: blob.url,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            objectType,
            objectId,
            evidenceRequestId: evidenceRequestId || null,
          }),
        })

        const data = await res.json()
        if (res.ok && data.data) {
          setAttachments((prev) => [data.data, ...prev])
        } else {
          setError(data.error ?? `Erro ao registrar "${file.name}".`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido'
        setError(`Erro ao enviar "${file.name}": ${msg}`)
      } finally {
        setUploading((prev) => prev.filter((u) => u.tempId !== tempId))
      }
    }
  }

  async function handleDelete(id: string) {
    setDeleting((prev) => new Set(prev).add(id))
    const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id))
    }
    setDeleting((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  const isEmpty = attachments.length === 0 && uploading.length === 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Anexos
          {attachments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              {attachments.length}
            </span>
          )}
        </h3>
        {canUpload && (
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                       text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Adicionar
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg mb-3">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Zona de drag & drop */}
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
          }}
          onClick={() => isEmpty && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-4 py-3 text-center text-xs transition-colors mb-3
            ${dragging
              ? 'border-blue-400 bg-blue-50 text-blue-600'
              : isEmpty
              ? 'border-gray-200 text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-500'
              : 'border-gray-100 text-gray-300 cursor-default'
            }`}
        >
          {dragging
            ? 'Solte para fazer upload'
            : isEmpty
            ? 'Arraste arquivos aqui ou clique para selecionar'
            : 'Arraste mais arquivos aqui'}
        </div>
      )}

      {/* Uploads em andamento — com barra de progresso */}
      {uploading.map((u) => (
        <div key={u.tempId} className="py-2.5 border-b border-gray-50">
          <div className="flex items-center gap-3 mb-1">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-600 truncate">{u.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(u.size)} · {u.progress < 100 ? `${Math.round(u.progress)}% enviado` : 'finalizando…'}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-200"
              style={{ width: `${u.progress}%` }}
            />
          </div>
        </div>
      ))}

      {/* Lista de anexos */}
      {attachments.length === 0 && uploading.length === 0 && !canUpload && (
        <p className="text-sm text-gray-400 text-center py-4">Nenhum anexo</p>
      )}

      <div className="space-y-0">
        {attachments.map((att) => {
          const meta  = FILE_META[att.mimeType] ?? { label: 'ARQ', cls: 'bg-gray-100 text-gray-600' }
          const canDel = canDeleteAll || att.uploadedBy.id === currentUserId

          return (
            <div
              key={att.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
            >
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${meta.cls}`}>
                {meta.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700 truncate">{att.originalName}</p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(att.sizeBytes)} · {att.uploadedBy.name} · {timeAgo(new Date(att.createdAt))}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={`/api/attachments/${att.id}/url`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Baixar"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                {canDel && (
                  <button
                    onClick={() => handleDelete(att.id)}
                    disabled={deleting.has(att.id)}
                    title="Excluir"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deleting.has(att.id)
                      ? <div className="animate-spin w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {canUpload && (
        <p className="text-xs text-gray-400 mt-3">
          PDF, DOC, XLS, JPG, PNG, ZIP · Máx. 50 MB por arquivo
        </p>
      )}
    </div>
  )
}
