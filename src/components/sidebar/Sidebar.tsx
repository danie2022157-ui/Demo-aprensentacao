import React from 'react';
import {
  LayoutDashboard,
  Users,
  Kanban,
  FileSpreadsheet,
  CalendarClock,
  Wallet,
  Calculator,
  BarChart3,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { NavSection } from '../../types/crm';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pendingFollowUps: number;
  overdueFollowUps: number;
  unattendedCount: number;
  overdueProposalsCount: number;
  overdueFinancialCount: number;
  onRequestReset: () => void;
  onOpenDiagnostic: () => void;
}

export function OnethyMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 3L31 10.5V25.5L18 33L5 25.5V10.5L18 3Z"
        stroke="url(#onethy-gold)"
        strokeWidth="2.4"
        fill="#14161D"
      />
      <path
        d="M18 9.5L25.5 13.8V22.2L18 26.5L10.5 22.2V13.8L18 9.5Z"
        stroke="#E8C96D"
        strokeWidth="1.6"
        fill="rgba(212, 175, 55, 0.12)"
      />
      <circle cx="18" cy="18" r="3.2" fill="#D4AF37" />
      <defs>
        <linearGradient
          id="onethy-gold"
          x1="5"
          y1="3"
          x2="31"
          y2="33"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F3DC8B" />
          <stop offset="0.5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#9A7818" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  pendingFollowUps,
  overdueFollowUps,
  unattendedCount,
  overdueProposalsCount,
  overdueFinancialCount,
  onRequestReset,
  onOpenDiagnostic,
}) => {
  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    counter?: number;
    alert?: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users },
    {
      id: 'funil',
      label: 'Funil Comercial',
      icon: Kanban,
      counter: unattendedCount > 0 ? unattendedCount : undefined,
      alert: unattendedCount > 0,
    },
    {
      id: 'orcamentos',
      label: 'Orçamentos',
      icon: FileSpreadsheet,
      counter: overdueProposalsCount > 0 ? overdueProposalsCount : undefined,
      alert: overdueProposalsCount > 0,
    },
    {
      id: 'tarefas',
      label: 'Follow-up & Tarefas',
      icon: CalendarClock,
      counter: pendingFollowUps,
      alert: overdueFollowUps > 0,
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: Wallet,
      counter: overdueFinancialCount > 0 ? overdueFinancialCount : undefined,
      alert: overdueFinancialCount > 0,
    },
    {
      id: 'simulador',
      label: 'Diagnóstico & Simulador',
      icon: Calculator,
    },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ];

  const handleNavClick = (section: NavSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const renderContent = (isCompact: boolean) => (
    <div className="flex flex-col h-full bg-[#0E1015] border-r border-white/[0.07]">
      {/* Brand Header */}
      <div
        className={`flex items-center h-16 px-4 border-b border-white/[0.06] ${
          isCompact ? 'justify-center' : 'justify-between'
        }`}
      >
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-md"
          aria-label="Onethy Demo Comercial — Ir para o Dashboard"
        >
          <OnethyMark className="w-8 h-8 shrink-0" />
          {!isCompact && (
            <span className="font-semibold text-[16px] tracking-tight text-white whitespace-nowrap">
              ONETHY <span className="text-[#D4AF37] font-medium">Demo</span>
            </span>
          )}
        </button>

        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu de navegação"
            className="lg:hidden p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Navegação principal"
        className="flex-1 py-3.5 px-2.5 space-y-1 overflow-y-auto"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              title={isCompact ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                isCompact ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
              } ${
                active
                  ? 'bg-[#D4AF37]/[0.12] text-[#F3DC8B] border border-[#D4AF37]/25'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon
                className={`w-[17px] h-[17px] shrink-0 ${
                  active ? 'text-[#D4AF37]' : 'text-neutral-400'
                }`}
              />
              {!isCompact && (
                <>
                  <span className="text-[13px] font-medium truncate whitespace-nowrap flex-1 text-left">
                    {item.label}
                  </span>
                  {typeof item.counter === 'number' && (
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        item.alert
                          ? 'text-[#F59E0B]'
                          : active
                          ? 'text-[#E8C96D]'
                          : 'text-neutral-500'
                      }`}
                    >
                      {item.counter}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-2.5 border-t border-white/[0.06] space-y-1">
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenDiagnostic();
          }}
          title={isCompact ? 'Solicitar diagnóstico operacional' : undefined}
          className={`w-full flex items-center gap-2 rounded-lg bg-[#D4AF37]/12 hover:bg-[#D4AF37]/22 border border-[#D4AF37]/30 text-[#F3DC8B] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
            isCompact ? 'justify-center px-2 py-2' : 'px-3 py-2'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 shrink-0 text-[#D4AF37]" />
          {!isCompact && (
            <span className="text-[12.5px] font-semibold whitespace-nowrap">
              Solicitar Diagnóstico
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onRequestReset();
          }}
          title={isCompact ? 'Restaurar dados de demonstração' : undefined}
          className={`w-full flex items-center gap-2.5 rounded-lg text-neutral-400 hover:text-[#E8C96D] hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
            isCompact ? 'justify-center px-2 py-2' : 'px-3 py-2'
          }`}
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          {!isCompact && (
            <span className="text-[12.5px] font-medium whitespace-nowrap">
              Restaurar Demo
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={
            isCompact ? 'Expandir barra lateral' : 'Recolher barra lateral'
          }
          className={`hidden lg:flex w-full items-center gap-2.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
            isCompact ? 'justify-center px-2 py-2' : 'px-3 py-1.5'
          }`}
        >
          {isCompact ? (
            <PanelLeftOpen className="w-4 h-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" />
              <span className="text-[12px] whitespace-nowrap">Compactar menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-[68px]' : 'w-[244px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderContent(collapsed)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[268px] max-w-[84vw] h-full">
            {renderContent(false)}
          </aside>
        </div>
      )}
    </>
  );
};
