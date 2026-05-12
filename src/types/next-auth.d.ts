import type { Role } from '@/types/enums'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: Role
      areaScopes: {
        areaId: string
        areaName: string
        canWrite: boolean
        isPrimary: boolean
      }[]
    }
  }

  interface User {
    role: Role
    areaScopes: {
      areaId: string
      areaName: string
      canWrite: boolean
      isPrimary: boolean
    }[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    areaScopes: {
      areaId: string
      areaName: string
      canWrite: boolean
      isPrimary: boolean
    }[]
  }
}
