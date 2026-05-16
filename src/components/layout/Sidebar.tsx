'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { LayoutDashboard, Layers, FileText, Building2, Users, Settings, UserCircle, LogOut, X, ChevronDown, ChevronRight, CalendarDays, ClipboardList, ArrowRightLeft, Briefcase, BarChart2, LayoutGrid, Activity, FileBarChart } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CDGLogo } from './CDGLogo'
import { getRoleLabel } from '@/lib/role-labels'

const AREAS = [
  { name: 'Planejamento', href: '/areas/planejamento', code: 'PLAN' },
  { name: 'Obras Próprias', href: '/areas/obras-proprias', code: 'OBRAS_PROP' },
  { name: 'Parceiros', href: '/areas/obras-terceirizadas', code: 'OBRAS_TERC' },
  { name: 'SESMT e Logística', href: '/areas/sesmt', code: 'SESMT' },
  { name: 'Equip. e Almoxarifado', href: '/areas/equipamentos', code: 'EQUIP' },
]

interface SidebarProps {
  session: Session
  onClose?: () => void
}

export function Sidebar({ session, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [areasOpen, setAreasOpen] = useState(true)
  const { role } = session.user
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isLeadership = role === 'master' || role === 'director' || role === 'admin'
  const isCoordinator = role === 'manager'
  const showDashboard = isLeadership || isCoordinator

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        <CDGLogo />
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white lg:hidden"><X className="w-5 h-5" /></button>}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {showDashboard && (
          <NavItem href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active={isActive('/dashboard')} />
        )}

        <NavItem href="/meu-workspace" icon={<LayoutGrid className="w-4 h-4" />} label="Meu Workspace" active={isActive('/meu-workspace')} />

        <div>
          <button onClick={() => setAreasOpen(!areasOpen)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', 'text-gray-300 hover:text-white hover:bg-gray-800')}>
            <Layers className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Áreas</span>
            {areasOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {areasOpen && (
            <div className="ml-6 mt-0.5 space-y-0.5">
              {AREAS.map((area) => (
                <Link key={area.code} href={area.href} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive(area.href) ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                  {area.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <NavItem href="/contratos" icon={<FileText className="w-4 h-4" />} label="Contratos" active={isActive('/contratos')} />
        <NavItem href="/evidencias" icon={<Building2 className="w-4 h-4" />} label="Evidências" active={isActive('/evidencias')} />
        <NavItem href="/calendario" icon={<CalendarDays className="w-4 h-4" />} label="Calendário" active={isActive('/calendario')} />
        {(isLeadership || isCoordinator) && (
          <NavItem href="/pauta" icon={<ClipboardList className="w-4 h-4" />} label="Pauta" active={isActive('/pauta')} />
        )}
        {(isLeadership || isCoordinator) && (
          <NavItem href="/projetos" icon={<Briefcase className="w-4 h-4" />} label="Projetos" active={isActive('/projetos')} />
        )}
        {(isLeadership || isCoordinator) && (
          <NavItem href="/atividade" icon={<Activity className="w-4 h-4" />} label="Atividade" active={isActive('/atividade')} />
        )}

        {isLeadership && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <NavItem href="/analytics" icon={<BarChart2 className="w-4 h-4" />} label="Analytics" active={isActive('/analytics')} />
            <NavItem href="/relatorio-executivo" icon={<FileBarChart className="w-4 h-4" />} label="Rel. Executivo" active={isActive('/relatorio-executivo')} />
            <NavItem href="/relatorio-interarea" icon={<ArrowRightLeft className="w-4 h-4" />} label="Interárea" active={isActive('/relatorio-interarea')} />
            <NavItem href="/admin/usuarios" icon={<Users className="w-4 h-4" />} label="Usuários" active={isActive('/admin/usuarios')} />
            <NavItem href="/admin/auditoria" icon={<Settings className="w-4 h-4" />} label="Auditoria" active={isActive('/admin/auditoria')} />
          </>
        )}
      </nav>

      <div className="border-t border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium">{session.user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
            <p className="text-xs text-gray-400">{getRoleLabel(role)}</p>
          </div>
        </div>
        <Link href="/minha-conta" className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors mb-1">
          <UserCircle className="w-3 h-3" />
          Minha conta
        </Link>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <LogOut className="w-3 h-3" />
          Sair
        </button>
      </div>
    </div>
  )
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return <Link href={href} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', active ? 'text-white bg-gray-700' : 'text-gray-300 hover:text-white hover:bg-gray-800')}>{icon}<span>{label}</span></Link>
}