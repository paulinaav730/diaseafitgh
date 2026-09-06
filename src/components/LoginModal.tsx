import React, { useState } from 'react';
import { Person, CurrentUser } from '../types';
import { ShieldCheck, User, Lock, Key, AlertCircle, ArrowRight, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  people: Person[];
  onLoginSuccess: (user: CurrentUser, remember?: boolean) => void;
  currentAuthUser: CurrentUser | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  people,
  onLoginSuccess,
  currentAuthUser,
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'admin'>('staff');

  // Admin form state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Staff form state
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState(''); // Cédula

  // Session persistence preference (default true as requested)
  const [rememberMe, setRememberMe] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = adminUser.trim().toUpperCase();
    const cleanPass = adminPass.trim();

    // Required Admin: DIAS2026 / 2580DIAS (also accepting DIAS / 2580DIAS)
    if (
      (cleanUser === 'DIAS2026' && cleanPass === '2580DIAS') ||
      (cleanUser === 'DIAS' && cleanPass === '2580DIAS')
    ) {
      onLoginSuccess(
        {
          role: 'admin',
          adminData: {
            id: 'admin_master',
            username: cleanUser,
            name: 'Dirección General DÍAS EAFIT',
            role: 'admin',
          },
        },
        rememberMe
      );
      return;
    }

    setErrorMessage('Credenciales de Administrador incorrectas. Usuario: DIAS2026 / Contraseña requerida.');
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const rawQuery = staffUsername.trim().toLowerCase();
    const queryWithoutAt = rawQuery.startsWith('@') ? rawQuery.slice(1) : rawQuery;
    const passQuery = staffPassword.trim().replace(/\D/g, ''); // Cédula numbers only
    const passRaw = staffPassword.trim();

    if (!rawQuery || !passRaw) {
      setErrorMessage('Por favor ingresa tu usuario (o cédula/correo) y tu contraseña (cédula).');
      return;
    }

    // Lookup person by username, email, documentId or full name
    const foundPerson = people.find((p) => {
      const cleanDoc = p.documentId.trim().replace(/\D/g, '');
      const pUser = (p.username || '').toLowerCase().trim();
      const pUserWithoutAt = pUser.startsWith('@') ? pUser.slice(1) : pUser;
      const pEmail = (p.email || '').toLowerCase().trim();
      const pName = (p.name || '').toLowerCase().trim();

      const matchUser = pUser === rawQuery || pUserWithoutAt === queryWithoutAt;
      const matchEmail = pEmail === rawQuery;
      const matchDoc = cleanDoc === passQuery || p.documentId.trim() === rawQuery;
      const matchName = pName === rawQuery || pName.includes(rawQuery);

      if (!matchUser && !matchEmail && !matchDoc && !matchName) return false;

      // Validate password against documentId (cédula)
      const isPassCorrect =
        (passQuery && cleanDoc === passQuery) ||
        passRaw === p.documentId.trim();

      return isPassCorrect;
    });

    if (foundPerson) {
      onLoginSuccess(
        {
          role: 'staff',
          staffData: foundPerson,
        },
        rememberMe
      );
      return;
    }

    setErrorMessage(
      'Usuario o contraseña incorrectos. Verifica que tu usuario esté registrado y que la contraseña sea tu número de cédula.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose && currentAuthUser) {
          onClose();
        }
      }}
    >
      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#182535]">
        {onClose && currentAuthUser && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#F3EEDC] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF8EC] border-2 border-[#D48F20]/40 text-[#B83A24] flex items-center justify-center mx-auto shadow-2xs">
            <div className="w-0 h-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-[#B83A24] ml-1" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#182535] font-dalek tracking-wider">
            ACCESO DÍAS EAFIT
          </h2>
          <p className="text-xs text-[#64748B] font-montserrat">
            Ingresa a tu perfil como Staff o Administrador
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#FAF6EC] rounded-2xl border border-[#EADDC7] mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('staff');
              setErrorMessage(null);
            }}
            className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-[#B83A24] text-white shadow-xs font-dalek tracking-wide'
                : 'text-[#64748B] hover:text-[#182535] font-montserrat'
            }`}
          >
            <User className="w-4 h-4" />
            <span>STAFF / MI DÍAS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage(null);
            }}
            className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-[#B83A24] text-white shadow-xs font-dalek tracking-wide'
                : 'text-[#64748B] hover:text-[#182535] font-montserrat'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>ADMINISTRADOR</span>
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#FDF2EE] border border-[#F6C7BA] text-xs font-semibold text-[#B83A24] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-montserrat leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Form: Staff */}
        {activeTab === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                Usuario, Correo o Cédula
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  placeholder="Ej: @usuario, correo o cédula"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat"
                />
                <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                Contraseña (Número de Cédula)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Tu número de documento de identidad"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat"
                />
                <Key className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              </div>
              <p className="text-[11px] text-[#64748B] font-montserrat mt-1">
                Tu contraseña de acceso es tu número de cédula registrado en el sistema.
              </p>
            </div>

            {/* Remember me option */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-[#475569] font-montserrat pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-md text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] accent-[#B83A24] cursor-pointer"
              />
              <span className="font-medium text-[#182535]">Recordar mi sesión en este dispositivo</span>
            </label>

            <button
              type="submit"
              className="w-full min-h-[44px] mt-2 py-3 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs sm:text-sm font-dalek tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>INGRESAR A MI DÍAS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: Administrator */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                Usuario Maestro de Dirección
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="DIAS2026"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat font-semibold"
                />
                <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                Contraseña de Dirección
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat"
                />
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Remember me option */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-[#475569] font-montserrat pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-md text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] accent-[#B83A24] cursor-pointer"
              />
              <span className="font-medium text-[#182535]">Recordar mi sesión en este dispositivo</span>
            </label>

            <button
              type="submit"
              className="w-full min-h-[44px] mt-2 py-3 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs sm:text-sm font-dalek tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>INGRESAR COMO ADMINISTRADOR</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#EADDC7] text-center">
          <p className="text-[11px] text-[#64748B] font-montserrat">
            Sistema Oficial de Gestión • DÍAS EAFIT 2026
          </p>
        </div>
      </div>
    </div>
  );
};
