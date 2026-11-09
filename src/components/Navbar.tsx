import React, { useState } from 'react';
import {
  Calendar,
  Users,
  Grid,
  Clock,
  Utensils, ClipboardCheck,
  Settings,
  Shield,
  UserCheck,
  LogOut,
  Radio,
  Search,
  RefreshCw,
  ChevronDown,
  Menu,
  X,
  Home,
  MapPin,
  Flame,
  Tag,
  Layers,
  Shirt,
  CalendarDays,
  Trophy,
} from 'lucide-react';
import { CurrentUser } from '../types';
import { DiasLogo } from './DiasLogo';
import { NotificationBell } from './NotificationBell';

export type TabType =
  | 'dashboard'
  | 'calendar'
  | 'league'
  | 'people'
  | 'config'
  | 'assignments'
  | 'functions'
  | 'availability'
  | 'attendance'
  | 'food'
  | 'food_control'
  | 'shirts';

interface NavbarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  peopleCount: number;
  functionsCount?: number;
  shiftsCount?: number;
  pendingShirtsCount?: number;
  onOpenSettings: () => void;
  currentUser: CurrentUser | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onSearchQuery?: (q: string) => void;
}

interface NavTabItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  peopleCount,
  functionsCount,
  shiftsCount,
  pendingShirtsCount,
  onOpenSettings,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onSearchQuery,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const tabs: NavTabItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Calendar },
    { id: 'calendar', label: 'Calendario', icon: CalendarDays },
    { id: 'league', label: 'DÍAS League', icon: Trophy },
    { id: 'people', label: 'Personas', icon: Users, badge: peopleCount },
    { id: 'assignments', label: 'Turnos y Bases', icon: Grid },
    ...(isAdmin
      ? [
          {
            id: 'config' as TabType,
            label: 'Configurar Turnos/Bases',
            icon: Layers,
            badge: shiftsCount,
          },
          {
            id: 'functions' as TabType,
            label: 'Funciones',
            icon: Tag,
            badge: functionsCount,
          },
        ]
      : []),
    { id: 'availability', label: 'Disponibilidad', icon: Clock },
    { id: 'attendance', label: 'Control en Vivo', icon: Radio },
    { id: 'food', label: 'Cálculo Alim.', icon: Utensils },
    { id: 'food_control', label: 'Control Alim.', icon: ClipboardCheck },
    { id: 'shirts', label: 'Camisetas', icon: Shirt, badge: pendingShirtsCount },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchQuery) onSearchQuery(searchInput);
  };

  return (
    <>
      <header className="bg-negro text-white sticky top-0 z-30 shadow-lg shadow-black/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
            {/* Marca: logo oficial DÍAS EAFIT sobre fondo negro */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => onTabChange('dashboard')}
                className="shrink-0 cursor-pointer transition-transform hover:scale-[1.03]"
                title="DÍAS EAFIT"
              >
                <DiasLogo variant="dark" className="h-10 sm:h-12 w-auto" />
              </button>

              <div className="hidden sm:block pl-4 border-l border-white/15 min-w-0">
                <p className="text-[10px] text-white font-subtitle truncate">
                  {isAdmin ? 'Panel de Dirección' : 'Portal de Staff'}
                </p>
                <p className="text-[11px] text-white/55 font-sans truncate">
                  {isAdmin ? 'Gestión de turnos, bases y equipo' : 'Mi DÍAS'}
                </p>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* En Vivo */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-turquesa-300/15 text-turquesa-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-turquesa-300 animate-pulse" />
                <span className="font-sans">En vivo</span>
                <RefreshCw className="w-3 h-3" />
              </div>

              {/* Búsqueda rápida */}
              <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-36 lg:w-48 pl-8 pr-3 py-1.5 rounded-xl bg-white/8 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-lila-300 focus:bg-white/12 transition-all font-sans"
                />
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5" />
              </form>

              {/* Notificaciones */}
              <NotificationBell currentUser={currentUser} />

              {/* Usuario */}
              {currentUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isAdmin ? 'bg-lila-300 hover:bg-lila-200 text-negro' : 'bg-mostaza-300 text-negro'
                    }`}
                    onClick={() => {
                      if (isAdmin) onOpenSettings();
                    }}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="font-sans truncate max-w-[90px] sm:max-w-[130px]">
                      {isAdmin ? 'Director' : currentUser.staffData?.name || 'Staff'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </div>

                  {isAdmin && (
                    <button
                      onClick={onOpenSettings}
                      title="Configuración y Auditoría"
                      className="p-2 rounded-xl bg-white/8 hover:bg-white/15 text-white/70 hover:text-white transition-colors hidden sm:block"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={onLogout}
                    title="Cerrar Sesión"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white/70 hover:text-white bg-white/8 hover:bg-white/15 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline font-sans">Salir</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-negro bg-lila-300 hover:bg-lila-200 flex items-center gap-2 transition-all font-sans"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Ingresar</span>
                </button>
              )}
            </div>
          </div>

          {/* Pestañas de escritorio (Admin) */}
          {isAdmin && (
            <nav className="hidden lg:flex items-center gap-1 py-2 border-t border-white/10 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`min-h-[38px] shrink-0 whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-lila-300 text-negro'
                        : 'text-white/65 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-sans">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 rounded-full font-bold tabular-nums ${
                          isActive ? 'bg-negro/15 text-negro' : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar matching image.png */}
      {isAdmin && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-tinta-200 py-1.5 px-3 flex justify-around items-center shadow-lg">
          {/* Inicio (Dashboard) */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'dashboard' ? 'text-lila-600' : 'text-tinta-500'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="font-sans">Inicio</span>
          </button>

          {/* Turnos GT (Turnos y Bases) */}
          <button
            onClick={() => onTabChange('assignments')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'assignments' ? 'text-lila-600' : 'text-tinta-500'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-sans">Turnos GT</span>
          </button>

          {/* Bases GAP */}
          <button
            onClick={() => onTabChange('assignments')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'assignments' ? 'text-mostaza-600' : 'text-tinta-500'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="font-sans">Bases GAP</span>
          </button>

          {/* Control Alimentación */}
          <button
            onClick={() => onTabChange('food_control')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'food_control' ? 'text-lila-600' : 'text-tinta-500'
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
            <span className="font-sans">Control Alim.</span>
          </button>

          {/* Menú drawer toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              isMobileMenuOpen ? 'text-lila-600' : 'text-tinta-500'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="font-sans">Menú</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-surface border-t-2 border-tinta-200 rounded-t-3xl p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-tinta-200 pb-3">
              <span className="font-display text-lg text-tinta-900">MENÚ PRINCIPAL DÍAS</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-tinta-100 text-tinta-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold text-left transition-all ${
                      isActive
                        ? 'bg-lila-600 text-white'
                        : 'bg-tinta-50 text-tinta-900 hover:bg-tinta-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-sans">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-tinta-200 flex items-center justify-between">
              <button
                onClick={() => {
                  onOpenSettings();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-xs font-bold text-tinta-500 hover:text-tinta-900"
              >
                <Settings className="w-4 h-4" />
                <span className="font-sans">Configuración</span>
              </button>

              <button
                onClick={() => {
                  onLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 text-xs font-bold text-lila-600"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-sans">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
