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

  // Sem sessão → redireciona para login
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rotas de admin → apenas role=admin
  const adminPaths = ['/admin', '/api/users']
  if (adminPaths.some((p) => pathname.startsWith(p))) {
    if (!['admin', 'director'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Pauta → apenas director e admin
  if (pathname.startsWith('/pauta') && pathname.includes('/nova')) {
    if (!['director', 'admin'].includes(session.user.role)) {
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
