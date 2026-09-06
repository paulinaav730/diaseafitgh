import React, { useState } from 'react';
import {
  Calendar,
  Users,
  Grid,
  Clock,
  Utensils,
  Settings,
  Shield,
  UserCheck,
  LogOut,
  Radio,
  Search,
  Bell,
  RefreshCw,
  ChevronDown,
  Menu,
  X,
  Home,
  MapPin,
  Flame,
  Tag,
  Layers,
} from 'lucide-react';
import { CurrentUser } from '../types';

export type TabType =
  | 'dashboard'
  | 'people'
  | 'assignments'
  | 'config'
  | 'functions'
  | 'availability'
  | 'attendance'
  | 'food';

interface NavbarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  peopleCount: number;
  functionsCount?: number;
  shiftsCount?: number;
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
    { id: 'food', label: 'Alimentación', icon: Utensils },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchQuery) onSearchQuery(searchInput);
  };

  return (
    <>
      <header className="bg-[#FFFDF8] border-b border-[#EADDC7] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
            {/* Brand Section matching image.png */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              {/* Triangular Emblem / Play Icon */}
              <button
                onClick={() => onTabChange('dashboard')}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#FFF9ED] border-2 border-[#D48F20]/50 hover:border-[#B83A24] flex items-center justify-center text-[#B83A24] shadow-xs transition-all group shrink-0"
                title="DÍAS EAFIT 2026"
              >
                <div className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-[#B83A24] group-hover:border-l-[#8F2714] ml-0.5 transition-colors" />
              </button>

              <div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span
                    onClick={() => onTabChange('dashboard')}
                    className="cursor-pointer text-[#182535] font-extrabold text-xl sm:text-2xl tracking-wide font-dalek"
                  >
                    DÍAS EAFIT
                  </span>
                  <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40 font-montserrat">
                    2026
                  </span>
                  <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] font-montserrat">
                    OFICIAL
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#64748B] font-medium hidden xs:block font-montserrat">
                  {isAdmin ? 'Panel de Dirección General' : 'Portal de Staff • Mi DÍAS'}
                </p>
              </div>
            </div>

            {/* Top Right Controls matching image.png */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* En Vivo Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] text-xs font-semibold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-ping" />
                <span className="font-montserrat">En Vivo</span>
                <RefreshCw className="w-3 h-3 text-[#16A34A]" />
              </div>

              {/* Quick Search */}
              <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
                <input
                  type="text"
                  placeholder="Buscar... ⌘K"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-36 lg:w-48 pl-8 pr-3 py-1.5 rounded-xl bg-[#F8F4EA] border border-[#E2D6BC] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] transition-all font-montserrat"
                />
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5" />
              </form>

              {/* Notification Bell */}
              <button
                onClick={() => onTabChange('attendance')}
                title="Notificaciones y Alertas"
                className="relative p-2 rounded-xl bg-[#F8F4EA] hover:bg-[#EFE7D5] border border-[#E2D6BC] text-[#64748B] hover:text-[#182535] transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B83A24] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  1
                </span>
              </button>

              {/* User Profile / Director Pill Button */}
              {currentUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs ${
                      isAdmin ? 'bg-[#B83A24] hover:bg-[#A32F1A]' : 'bg-[#182535]'
                    } transition-colors cursor-pointer`}
                    onClick={() => {
                      if (isAdmin) onOpenSettings();
                    }}
                  >
                    <Shield className="w-3.5 h-3.5 text-white/90" />
                    <span className="font-montserrat truncate max-w-[90px] sm:max-w-[130px]">
                      {isAdmin ? 'Director' : currentUser.staffData?.name || 'Staff'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/80" />
                  </div>

                  {/* Settings icon for Admin */}
                  {isAdmin && (
                    <button
                      onClick={onOpenSettings}
                      title="Configuración y Auditoría"
                      className="p-2 rounded-xl bg-[#F8F4EA] hover:bg-[#EFE7D5] border border-[#E2D6BC] text-[#64748B] hover:text-[#182535] transition-colors hidden sm:block"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}

                  {/* Exit / Salir button */}
                  <button
                    onClick={onLogout}
                    title="Cerrar Sesión"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] border border-[#F6C7BA] transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline font-montserrat">Salir</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#B83A24] hover:bg-[#9E2F1B] shadow-md font-dalek tracking-wider flex items-center gap-2 transition-all"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>INGRESAR</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs for Admin */}
          {isAdmin && (
            <nav className="hidden lg:flex items-center gap-1.5 py-2 border-t border-[#EADDC7]/60 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#B83A24] text-white shadow-xs'
                        : 'text-[#334155] hover:text-[#182535] hover:bg-[#F3EEDC]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-montserrat">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-mono font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#EAE0CA] text-[#475569]'
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF8]/95 backdrop-blur-md border-t border-[#EADDC7] py-1.5 px-3 flex justify-around items-center shadow-lg">
          {/* Inicio (Dashboard) */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'dashboard' ? 'text-[#B83A24]' : 'text-[#64748B]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="font-montserrat">Inicio</span>
          </button>

          {/* Turnos GT (Turnos y Bases) */}
          <button
            onClick={() => onTabChange('assignments')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'assignments' ? 'text-[#B83A24]' : 'text-[#64748B]'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-montserrat">Turnos GT</span>
          </button>

          {/* Bases GAP */}
          <button
            onClick={() => onTabChange('assignments')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'assignments' ? 'text-[#C87F17]' : 'text-[#64748B]'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="font-montserrat">Bases GAP</span>
          </button>

          {/* Alimentación */}
          <button
            onClick={() => onTabChange('food')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              currentTab === 'food' ? 'text-[#B83A24]' : 'text-[#64748B]'
            }`}
          >
            <Utensils className="w-5 h-5" />
            <span className="font-montserrat">Alimentación</span>
          </button>

          {/* Menú drawer toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold ${
              isMobileMenuOpen ? 'text-[#B83A24]' : 'text-[#64748B]'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="font-montserrat">Menú</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-[#FFFDF8] border-t-2 border-[#EADDC7] rounded-t-3xl p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EADDC7] pb-3">
              <span className="font-dalek text-lg text-[#182535]">MENÚ PRINCIPAL DÍAS</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-[#F3EEDC] text-[#64748B]"
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
                        ? 'bg-[#B83A24] text-white'
                        : 'bg-[#F9F5EA] text-[#182535] hover:bg-[#F1E8D2]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-montserrat">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#EADDC7] flex items-center justify-between">
              <button
                onClick={() => {
                  onOpenSettings();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-xs font-bold text-[#64748B] hover:text-[#182535]"
              >
                <Settings className="w-4 h-4" />
                <span className="font-montserrat">Configuración</span>
              </button>

              <button
                onClick={() => {
                  onLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 text-xs font-bold text-[#B83A24]"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-montserrat">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
