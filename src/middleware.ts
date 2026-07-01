import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Rotas públicas — deixa passar
  const publicPaths = ['/login', '/recuperar-senha', '/api/auth']
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Crons não têm sessão — autenticam por header próprio dentro da rota
  // (isCronAuthorized). Sem este bypass, o middleware redirecionava o cron p/ /login.
  const cronPaths = ['/api/demands/overdue', '/api/demands/sla-check', '/api/demands/escalation', '/api/rotinas/gerar-ocorrencias']
  if (cronPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Sem sessão → redireciona para login
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rotas de admin → apenas role=admin
  // (/api/users fica de fora: GET/POST/PATCH/DELETE já checam permissão por
  // operação dentro de cada handler — coordenador/supervisor/técnico precisam
  // de GET /api/users para montar seletor de equipe e busca de colaboradores)
  const adminPaths = ['/admin']
  if (adminPaths.some((p) => pathname.startsWith(p))) {
    if (!['master', 'admin', 'director'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Pauta → apenas director e admin
  if (pathname.startsWith('/pauta') && pathname.includes('/nova')) {
    if (!['master', 'director', 'admin'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg).*)',
  ],
}
