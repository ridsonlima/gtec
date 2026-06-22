import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/types/api'

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

// GET /api/me/approvo — lê a configuração Approvo do próprio usuário
export async function GET() {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      approvoTipoAcesso: true,
      approvoCodUsuario: true,
      approvoCodPerfil: true,
      approvoCodUsuarioMega: true,
    },
  })
  if (!user) return apiError('Usuário não encontrado', 404)

  return apiSuccess({
    approvoTipoAcesso: user.approvoTipoAcesso ?? 'C',
    approvoCodUsuario: user.approvoCodUsuario,
    approvoCodPerfil: user.approvoCodPerfil,
    approvoCodUsuarioMega: user.approvoCodUsuarioMega,
    configurado: Boolean(
      user.approvoCodUsuario && user.approvoCodPerfil && user.approvoCodUsuarioMega
    ),
  })
}

// POST /api/me/approvo — o próprio usuário salva seus códigos do Approvo
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return apiError('Não autenticado', 401)

  const body = await req.json().catch(() => ({}))

  const tipoAcesso = body.approvoTipoAcesso ? String(body.approvoTipoAcesso).trim() : 'C'
  const codUsuario = toIntOrNull(body.approvoCodUsuario)
  const codPerfil = toIntOrNull(body.approvoCodPerfil)
  const codUsuarioMega = toIntOrNull(body.approvoCodUsuarioMega)

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      approvoTipoAcesso: tipoAcesso || 'C',
      approvoCodUsuario: codUsuario,
      approvoCodPerfil: codPerfil,
      approvoCodUsuarioMega: codUsuarioMega,
    },
  })

  return apiSuccess({
    configurado: Boolean(codUsuario && codPerfil && codUsuarioMega),
  })
}
