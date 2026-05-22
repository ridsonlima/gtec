'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { LayoutDashboard, Layers, FileText, Building2, Users, UserCircle, LogOut, X, ChevronDown, ChevronRight, CalendarDays, ClipboardList, ArrowRightLeft, Briefcase, Activity, Handshake, GitBranch, List, LayoutGrid, Truck, Package, Receipt, ClipboardCheck, Wrench, Gauge, CheckSquare } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CDGLogo } from './CDGLogo'
import { getRoleLabel } from '@/lib/role-labels'

const SALA_TECNICA = {
  name: 'Sala Técnica',
  href: '/areas/sala-tecnica',
  code: 'PLAN',
  children: [
    { name: 'Planejamento', href: '/areas/planejamento', code: 'PLAN_PLANEJ' },
    { name: 'Orçamento', href: '/areas/orcamento', code: 'PLAN_ORC' },
  ],
}

const AREAS = [
  { name: 'Obras Próprias', href: '/areas/obras-proprias', code: 'OBRAS_PROP' },
  { name: 'SESMT e Logística', href: '/areas/sesmt', code: 'SESMT' },
  { name: 'Equip. e Almoxarifado', href: '/areas/equipamentos', code: 'EQUIP' },
]

const AREA_PARCEIROS = { name: 'Parceiros', href: '/areas/obras-terceirizadas', code: 'OBRAS_TERC' }

interface SidebarProps {
  session: Session
  onClose?: () => void
}

export function Sidebar({ session, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [areasOpen, setAreasOpen] = useState(true)
  const [salaTecnicaOpen, setSalaTecnicaOpen] = useState(true)
  const [parceirosOpen, setParceirosOpen] = useState(false)
  const [demandasOpen, setDemandasOpen] = useState(pathname.startsWith('/demandas'))
  const isCdgRental = pathname.startsWith('/frota') || pathname.startsWith('/equipamentos')
  const [cdgRentalOpen, setCdgRentalOpen] = useState(isCdgRental)
  const [frotaOpen, setFrotaOpen] = useState(pathname.startsWith('/frota'))
  const [equipOpen, setEquipOpen] = useState(pathname.startsWith('/equipamentos'))
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

        <div>
          <button onClick={() => setAreasOpen(!areasOpen)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', 'text-gray-300 hover:text-white hover:bg-gray-800')}>
            <Layers className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Áreas</span>
            {areasOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {areasOpen && (
            <div className="ml-6 mt-0.5 space-y-0.5">
              {/* Sala Técnica com sub-áreas */}
              <div>
                <button
                  onClick={() => setSalaTecnicaOpen(!salaTecnicaOpen)}
                  className={cn('w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                    isActive(SALA_TECNICA.href) || SALA_TECNICA.children.some(c => isActive(c.href))
                      ? 'text-white bg-gray-700'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <span className="flex-1 text-left">{SALA_TECNICA.name}</span>
                  {salaTecnicaOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {salaTecnicaOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {SALA_TECNICA.children.map((sub) => (
                      <Link key={sub.code} href={sub.href} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive(sub.href) ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {AREAS.map((area) => (
                <Link key={area.code} href={area.href} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive(area.href) ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                  {area.name}
                </Link>
              ))}
              <div>
                <button
                  onClick={() => setParceirosOpen(!parceirosOpen)}
                  className={cn('w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive(AREA_PARCEIROS.href) || isActive('/gestao-parceiros') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}
                >
                  <span className="flex-1 text-left">{AREA_PARCEIROS.name}</span>
                  {parceirosOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {parceirosOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    <Link href={AREA_PARCEIROS.href} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive(AREA_PARCEIROS.href) ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      Visão geral
                    </Link>
                    <Link href="/gestao-parceiros" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', pathname === '/gestao-parceiros' ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Handshake className="w-3 h-3" />
                      Gestão de Parceiros
                    </Link>
                    <Link href="/gestao-parceiros/contratos" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/gestao-parceiros/contratos') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <FileText className="w-3 h-3" />
                      Contratos
                    </Link>
                    <Link href="/gestao-parceiros/empresas" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/gestao-parceiros/empresas') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Building2 className="w-3 h-3" />
                      Empresas
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Demandas com subitens */}
        <div>
          <button onClick={() => setDemandasOpen(!demandasOpen)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', isActive('/demandas') ? 'text-white bg-gray-700' : 'text-gray-300 hover:text-white hover:bg-gray-800')}>
            <ClipboardList className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Demandas</span>
            {demandasOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {demandasOpen && (
            <div className="ml-6 mt-0.5 space-y-0.5">
              <Link href="/demandas" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', pathname === '/demandas' ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                <List className="w-3 h-3" /> Lista
              </Link>
              <Link href="/demandas/pipeline" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/demandas/pipeline') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                <GitBranch className="w-3 h-3" /> Pipeline
              </Link>
              <Link href="/demandas/kanban" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/demandas/kanban') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                <LayoutGrid className="w-3 h-3" /> Kanban
              </Link>
            </div>
          )}
        </div>

        <NavItem href="/contratos" icon={<FileText className="w-4 h-4" />} label="Contratos" active={isActive('/contratos')} />

        {/* CDG RENTAL */}
        {(isLeadership || isCoordinator) && (
          <div>
            {/* Pai: CDG RENTAL */}
            <button
              onClick={() => setCdgRentalOpen(!cdgRentalOpen)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                isCdgRental ? 'text-white bg-gray-700' : 'text-gray-300 hover:text-white hover:bg-gray-800'
              )}
            >
              <Gauge className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left font-medium">CDG RENTAL</span>
              {cdgRentalOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            {cdgRentalOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5">

                {/* Sub: Frota */}
                <button
                  onClick={() => setFrotaOpen(!frotaOpen)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                    isActive('/frota') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <Truck className="w-3 h-3 flex-shrink-0" />
                  <span className="flex-1 text-left font-medium">Frota</span>
                  {frotaOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {frotaOpen && (
                  <div className="ml-5 space-y-0.5">
                    <Link href="/frota/dashboard" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/frota/dashboard') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Gauge className="w-3 h-3" /> Dashboard
                    </Link>
                    <Link href="/frota/ativos" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/frota/ativos') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Truck className="w-3 h-3" /> Veículos
                    </Link>
                    <Link href="/frota/medicoes" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/frota/medicoes') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Receipt className="w-3 h-3" /> Medições
                    </Link>
                    <Link href="/frota/auditorias" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/frota/auditorias') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <ClipboardCheck className="w-3 h-3" /> Auditorias
                    </Link>
                    <Link href="/frota/manutencao" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/frota/manutencao') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Wrench className="w-3 h-3" /> Manutenção
                    </Link>
                  </div>
                )}

                {/* Sub: Equipamentos */}
                <button
                  onClick={() => setEquipOpen(!equipOpen)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                    isActive('/equipamentos') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <Package className="w-3 h-3 flex-shrink-0" />
                  <span className="flex-1 text-left font-medium">Equipamentos</span>
                  {equipOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {equipOpen && (
                  <div className="ml-5 space-y-0.5">
                    <Link href="/equipamentos/dashboard" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/equipamentos/dashboard') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Gauge className="w-3 h-3" /> Dashboard
                    </Link>
                    <Link href="/equipamentos/ativos" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/equipamentos/ativos') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Package className="w-3 h-3" /> Equipamentos
                    </Link>
                    <Link href="/equipamentos/medicoes" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/equipamentos/medicoes') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Receipt className="w-3 h-3" /> Medições
                    </Link>
                    <Link href="/equipamentos/auditorias" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/equipamentos/auditorias') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <ClipboardCheck className="w-3 h-3" /> Auditorias
                    </Link>
                    <Link href="/equipamentos/manutencao" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/equipamentos/manutencao') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                      <Wrench className="w-3 h-3" /> Manutenção
                    </Link>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
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

        <div className="border-t border-gray-700 my-2" />
        <NavItem href="/minhas-tarefas" icon={<CheckSquare className="w-4 h-4" />} label="Minhas Tarefas" active={isActive('/minhas-tarefas')} />

        {isLeadership && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <NavItem href="/relatorio-interarea" icon={<ArrowRightLeft className="w-4 h-4" />} label="Interárea" active={isActive('/relatorio-interarea')} />
            <NavItem href="/admin/usuarios" icon={<Users className="w-4 h-4" />} label="Usuários" active={isActive('/admin/usuarios')} />
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