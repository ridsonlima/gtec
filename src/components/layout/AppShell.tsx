'use client'

import { useState } from 'react'
import type { Session } from 'next-auth'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface AppShellProps {
  session: Session
  children: React.ReactNode
}

export function AppShell({ session, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-60 flex flex-col">
          <Sidebar session={session} />
        </div>
      </div>

      {/* Sidebar mobile (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex flex-col w-60 bg-white shadow-xl">
            <Sidebar session={session} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
