'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { Camera, Upload, Loader2, X, User } from 'lucide-react'

interface FotoCaptureProps {
  value: string | null
  onChange: (url: string | null) => void
  size?: number
  /** Salva imediatamente ao capturar (chama onChange com a URL pronta). */
  disabled?: boolean
}

/**
 * Captura/seleção da foto do funcionário.
 * - Botão "Tirar foto" abre a câmera do celular (capture="environment").
 * - Botão "Galeria" permite escolher um arquivo existente.
 * O upload vai direto para o Vercel Blob; o callback recebe a URL pública.
 */
export function FotoCapture({ value, onChange, size = 128, disabled }: FotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Imagem muito grande (máx. 15 MB).')
      return
    }
    setUploading(true)
    try {
      const blob = await upload(`funcionarios/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/attachments/upload',
        clientPayload: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
      })
      onChange(blob.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload da foto.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-2xl overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Foto do funcionário" className="w-full h-full object-cover" />
        ) : (
          <User className="w-1/2 h-1/2 text-gray-300" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        {value && !uploading && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Remover foto"
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!disabled && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" /> Tirar foto
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Galeria
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 text-center max-w-[200px]">{error}</p>}

      {/* Câmera (celular abre a câmera traseira) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
      {/* Galeria / arquivo */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
