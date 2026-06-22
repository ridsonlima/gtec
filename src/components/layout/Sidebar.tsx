'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { LayoutDashboard, Layers, FileText, Building2, Users, UserCircle, LogOut, X, ChevronDown, ChevronRight, CalendarDays, ClipboardList, ArrowRightLeft, Briefcase, Activity, Handshake, GitBranch, List, LayoutGrid, Truck, Package, Receipt, ClipboardCheck, Wrench, Gauge, CheckSquare, Palmtree, Megaphone, FileBarChart, ListChecks, Gavel, FileSpreadsheet, HardHat } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { CDGLogo } from './CDGLogo'
import { getRoleLabel } from '@/lib/role-labels'
import { canManageFuncionarios } from '@/lib/permissions'

const SALA_TECNICA = {
  name: 'Sala Técnica',
  href: '/areas/sala-tecnica',
  code: 'PLAN',
  children: [
    { name: 'Planejamento', href: '/areas/planejamento', code: 'PLAN_PLANEJ' },
    { name: 'Orçamento', href: '/areas/orcamento', code: 'PLAN_ORC' },
  ],
}

const SESMT = {
  name: 'SESMT',
  code: 'SESMT',
  children: [
    { name: 'Meio Ambiente', href: '/areas/meio-ambiente', code: 'SESMT_MA' },
    { name: 'Seg. do Trab.', href: '/areas/seg-trabalho', code: 'SESMT_SEG' },
  ],
}

const AREAS = [
  { name: 'Obras Próprias', href: '/areas/obras-proprias', code: 'OBRAS_PROP' },
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
  const [sesmtOpen, setSesmtOpen] = useState(SESMT.children.some(c => pathname.startsWith(c.href)) || pathname.startsWith('/funcionarios'))
  const [parceirosOpen, setParceirosOpen] = useState(false)
  const [demandasOpen, setDemandasOpen] = useState(pathname.startsWith('/demandas'))
  const isCdgRental = pathname.startsWith('/frota') || pathname.startsWith('/equipamentos')
  const [cdgRentalOpen, setCdgRentalOpen] = useState(isCdgRental)
  const { role } = session.user
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isLeadership = role === 'master' || role === 'director' || role === 'admin'
  const isCoordinator = role === 'manager'
  const showDashboard = isLeadership || isCoordinator
  const showFuncionarios = canManageFuncionarios(session)

  // Comunicados pendentes de "ciente" → badge de destaque
  const { data: comunicadosPend } = useQuery({
    queryKey: ['comunicados-pendentes'],
    queryFn: () => fetch('/api/comunicados/pendentes').then((r) => r.json()),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const comunicadosBadge: number = comunicadosPend?.data?.count ?? 0

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 text-gray-100 border-r border-white/5">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <CDGLogo />
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white lg:hidden p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
              {/* SESMT com sub-áreas */}
              <div>
                <button
                  onClick={() => setSesmtOpen(!sesmtOpen)}
                  className={cn('w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                    SESMT.children.some(c => isActive(c.href))
                      ? 'text-white bg-gray-700'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <span className="flex-1 text-left">{SESMT.name}</span>
                  {sesmtOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {sesmtOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {SESMT.children.map((sub) => (
                      <Link key={sub.code} href={sub.href} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive(sub.href) ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                        {sub.name}
                      </Link>
                    ))}
                    {showFuncionarios && (
                      <Link href="/funcionarios" className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', isActive('/funcionarios') ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
                        <HardHat className="w-3.5 h-3.5 flex-shrink-0" /> Funcionários
                      </Link>
                    )}
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

        <NavItem href="/comunicados" icon={<Megaphone className="w-4 h-4" />} label="Comunicados" active={isActive('/comunicados')} badge={comunicadosBadge} />

        {(isLeadership || isCoordinator) && (
          <NavItem href="/pendencias" icon={<ListChecks className="w-4 h-4" />} label="Pendências" active={isActive('/pendencias')} />
        )}

        {(isLeadership || isCoordinator) && (
          <NavItem href="/aprovacoes" icon={<ClipboardCheck className="w-4 h-4" />} label="Aprovações" active={isActive('/aprovacoes')} />
        )}

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
                {[
                  { func: 'dashboard',  label: 'Dashboard',  icon: Gauge },
                  { func: 'ativos',     label: 'Ativos',     icon: Truck },
                  { func: 'medicoes',   label: 'Medições',   icon: Receipt },
                  { func: 'auditorias', label: 'Auditorias', icon: ClipboardCheck },
                  { func: 'manutencao', label: 'Manutenção', icon: Wrench },
                ].map(({ func, label, icon: ItemIcon }) => {
                  const ativo = pathname.startsWith(`/frota/${func}`) || pathname.startsWith(`/equipamentos/${func}`)
                  return (
                    <Link
                      key={func}
                      href={`/frota/${func}`}
                      className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors', ativo ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800')}
                    >
                      <ItemIcon className="w-3 h-3" /> {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
<NavItem href="/calendario" icon={<CalendarDays className="w-4 h-4" />} label="Calendário" active={isActive('/calendario')} />
        {(isLeadership || isCoordinator) && (
          <NavItem href="/pauta" icon={<ClipboardList className="w-4 h-4" />} label="Pauta" active={isActive('/pauta') || isActive('/decisoes')} />
        )}

        <div className="border-t border-gray-700 my-2" />
        <NavItem href="/minhas-tarefas" icon={<CheckSquare className="w-4 h-4" />} label="Minhas Tarefas" active={isActive('/minhas-tarefas')} />

        {(isLeadership || isCoordinator) && (
          <NavItem href="/cobertura" icon={<Palmtree className="w-4 h-4" />} label="Cobertura" active={isActive('/cobertura')} />
        )}

        {isLeadership && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <NavItem
              href="/relatorio-executivo"
              icon={<FileBarChart className="w-4 h-4" />}
              label="Relatórios"
              active={isActive('/relatorio-executivo') || isActive('/analytics') || isActive('/relatorio-interarea')}
            />
            <NavItem href="/admin/usuarios" icon={<Users className="w-4 h-4" />} label="Usuários" active={isActive('/admin/usuarios')} />
            <NavItem href="/admin/importar" icon={<FileSpreadsheet className="w-4 h-4" />} label="Importar CSV" active={isActive('/admin/importar')} />
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

function NavItem({ href, icon, label, active, badge }: { href: string; icon: React.ReactNode; label: string; active: boolean; badge?: number }) {
  const hasBadge = !!badge && badge > 0
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
        active
          ? 'text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-blue-900/40'
          : hasBadge
            ? 'text-amber-200 bg-amber-500/15 ring-1 ring-amber-400/40 hover:bg-amber-500/25'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {hasBadge && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-amber-400 text-amber-950 animate-pulse">
          {badge}
        </span>
      )}
    </Link>
  )
}