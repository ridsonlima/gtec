import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Role } from '@/types/enums'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            areaScopes: {
              include: { area: true },
            },
          },
        })

        if (!user || !user.isActive) {
          return null
        }

        const passwordOk = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!passwordOk) {
          return null
        }

        // Atualiza lastLoginAt e incrementa loginCount
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          areaScopes: user.areaScopes.map((s) => ({
            areaId: s.areaId,
            areaName: s.area.name,
            canWrite: s.canWrite,
            isPrimary: s.isPrimary,
          })),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.areaScopes = (user as any).areaScopes
        return token
      }
      // Requisições seguintes: reidrata perfil e áreas do banco, para que mudanças
      // de alçada valham na hora (sem precisar deslogar/relogar).
      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            areaScopes: { select: { areaId: true, canWrite: true, isPrimary: true, area: { select: { name: true } } } },
          },
        })
        if (fresh) {
          token.role = fresh.role
          token.areaScopes = fresh.areaScopes.map((s) => ({
            areaId: s.areaId, areaName: s.area.name, canWrite: s.canWrite, isPrimary: s.isPrimary,
          }))
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.areaScopes = token.areaScopes as any[]
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas
  },
})

