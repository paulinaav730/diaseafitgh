import React, { useState, useEffect, useMemo } from 'react';
import {
  Person,
  Assignment,
  AvailabilityRecord,
  AttendanceRecord,
  CurrentUser,
  GroupFunction,
  ShiftRequirement,
  AppEvent,
  ConfigurableShift,
  ConfigurableBase,
  isPersonShirtFullyDelivered,
} from './types';
import {
  subscribeToPeople,
  subscribeToAssignments,
  subscribeToAvailabilities,
  subscribeToAttendances,
  subscribeToFunctions,
  subscribeToRequirements,
  subscribeToEvents,
  subscribeToShifts,
  subscribeToBases,
} from './services/storageService';
import { Navbar, TabType } from './components/Navbar';
import { DiasLogo } from './components/DiasLogo';
import { DashboardView } from './components/DashboardView';
import { PeopleView } from './components/PeopleView';
import { AssignmentView } from './components/AssignmentView';
import { FunctionsView } from './components/FunctionsView';
import { ConfigurationView } from './components/ConfigurationView';
import { AvailabilityView } from './components/AvailabilityView';
import { AttendanceView } from './components/AttendanceView';
import { FoodView } from './components/FoodView';
import { FoodControlView } from './components/FoodControlView';
import { ShirtsView } from './components/ShirtsView';
import { SettingsModal } from './components/SettingsModal';
import { StaffMyDiasView } from './components/StaffMyDiasView';
import { LoginModal } from './components/LoginModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { CalendarView } from './components/CalendarView';
import { LeagueView } from './components/LeagueView';
import { StaffShell } from './components/StaffShell';
import { registerServiceWorker } from './services/pushService';
import { setCurrentSession } from './services/session';
import { api } from './services/leagueApi';
import { eventAttendances } from './services/leagueService';
import { reminderPreferences } from './services/calendarService';
import { Toaster } from './components/league/toast';
import { QrActionModal } from './components/QrActionModal';
import { clearPendingQr, onQr, takeQrFromUrl, QrKind } from './components/league/QrCode';
import { UserCheck } from 'lucide-react';
import { isSupabaseConfigured } from './services/supabaseClient';
import { syncAllFromSupabase } from './services/supabaseSync';

const INITIAL_USER_STORAGE_KEY = 'dias_eafit_current_user';

export default function App() {
  const [currentTab, setCurrentTabState] = useState<TabType>(() => {
    return (localStorage.getItem('dias_eafit_last_tab') as TabType) || 'dashboard';
  });

  const setCurrentTab = (tab: TabType) => {
    setCurrentTabState(tab);
    localStorage.setItem('dias_eafit_last_tab', tab);
  };
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availabilities, setAvailabilities] = useState<AvailabilityRecord[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [functions, setFunctions] = useState<GroupFunction[]>([]);
  const [requirements, setRequirements] = useState<ShiftRequirement[]>([]);
  const [shifts, setShifts] = useState<ConfigurableShift[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [bases, setBases] = useState<ConfigurableBase[]>([]);

  // Current session user: restored from localStorage/sessionStorage, or null if no session
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const stored = localStorage.getItem(INITIAL_USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.role === 'admin' || parsed.role === 'staff')) {
          return parsed;
        }
      }
      const sessionStored = sessionStorage.getItem(INITIAL_USER_STORAGE_KEY);
      if (sessionStored) {
        const parsed = JSON.parse(sessionStored);
        if (parsed && (parsed.role === 'admin' || parsed.role === 'staff')) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error reading stored session:', err);
    }
    return null;
  });

  // Sesión para las acciones protegidas (se registra antes del primer render)
  setCurrentSession(currentUser);

  // Automatically show login modal if no active session is found
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    try {
      const stored =
        localStorage.getItem(INITIAL_USER_STORAGE_KEY) ||
        sessionStorage.getItem(INITIAL_USER_STORAGE_KEY);
      return !stored;
    } catch {
      return true;
    }
  });
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [focusConectadosId, setFocusConectadosId] = useState<string | null>(null);
  // QR escaneado (enlace abierto con la cámara o lector de la app)
  const [qrAction, setQrAction] = useState<{ kind: QrKind; token: string } | null>(() => takeQrFromUrl());
  useEffect(() => onQr(setQrAction), []);

  // Service worker para notificaciones push del calendario
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    const unsubPeople = subscribeToPeople(setPeople);
    const unsubAssignments = subscribeToAssignments(setAssignments);
    const unsubAvail = subscribeToAvailabilities(setAvailabilities);
    const unsubAttendance = subscribeToAttendances(setAttendances);
    const unsubFunctions = subscribeToFunctions(setFunctions);
    const unsubRequirements = subscribeToRequirements(setRequirements);
    const unsubEvents = subscribeToEvents(setEvents);
    const unsubShifts = subscribeToShifts(setShifts);
    const unsubBases = subscribeToBases(setBases);

    return () => {
      unsubPeople();
      unsubAssignments();
      unsubAvail();
      unsubAttendance();
      unsubFunctions();
      unsubRequirements();
      unsubEvents();
      unsubShifts();
      unsubBases();
    };
  }, []);

  // Cada cambio de sesión recarga los datos privados (asistencias, recordatorios)
  useEffect(() => {
    setCurrentSession(currentUser);
    void eventAttendances.pull();
    void reminderPreferences.pull();
  }, [currentUser?.sessionToken, currentUser?.role]);

  // Con Supabase: la sesión debe existir y seguir vigente en el servidor
  useEffect(() => {
    if (!currentUser || !api.isRemote()) return;
    if (!currentUser.sessionToken || currentUser.sessionToken.startsWith('local-')) {
      handleLogout();
      return;
    }
    api.validateSession().then((valid) => {
      if (!valid) handleLogout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.sessionToken]);

  // Automatic cloud sync on app start if Supabase is configured
  useEffect(() => {
    if (isSupabaseConfigured()) {
      syncAllFromSupabase().catch((err) => {
        console.warn('Auto Supabase sync failed on mount:', err);
      });
    }
  }, []);

  // Keep staff data synchronized if database updates in real-time
  useEffect(() => {
    if (currentUser?.role === 'staff' && currentUser.staffData && people.length > 0) {
      const updatedPerson = people.find((p) => p.id === currentUser.staffData?.id);
      if (updatedPerson && JSON.stringify(updatedPerson) !== JSON.stringify(currentUser.staffData)) {
        const updatedUser: CurrentUser = {
          ...currentUser,
          staffData: updatedPerson,
        };
        setCurrentUser(updatedUser);
        try {
          if (localStorage.getItem(INITIAL_USER_STORAGE_KEY)) {
            localStorage.setItem(INITIAL_USER_STORAGE_KEY, JSON.stringify(updatedUser));
          } else if (sessionStorage.getItem(INITIAL_USER_STORAGE_KEY)) {
            sessionStorage.setItem(INITIAL_USER_STORAGE_KEY, JSON.stringify(updatedUser));
          }
        } catch {
          // ignore
        }
      }
    }
  }, [people, currentUser]);

  const handleLoginSuccess = (user: CurrentUser, remember: boolean = true) => {
    setCurrentUser(user);
    if (remember) {
      try {
        localStorage.setItem(INITIAL_USER_STORAGE_KEY, JSON.stringify(user));
        sessionStorage.removeItem(INITIAL_USER_STORAGE_KEY);
      } catch (err) {
        console.error('Failed to save session to localStorage:', err);
      }
    } else {
      try {
        sessionStorage.setItem(INITIAL_USER_STORAGE_KEY, JSON.stringify(user));
        localStorage.removeItem(INITIAL_USER_STORAGE_KEY);
      } catch (err) {
        console.error('Failed to save session to sessionStorage:', err);
      }
    }
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    void api.logout();
    setCurrentSession(null);
    setCurrentUser(null);
    try {
      localStorage.removeItem(INITIAL_USER_STORAGE_KEY);
      sessionStorage.removeItem(INITIAL_USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsAuthModalOpen(true);
  };

  // Conteo de personas activas con entrega de camiseta pendiente
  const pendingShirtsCount = useMemo(() => {
    return people.filter(
      (p) => p.isActive !== false && !isPersonShirtFullyDelivered(p)
    ).length;
  }, [people]);

  return (
    <div className="min-h-screen bg-tinta-50 text-tinta-900 flex flex-col selection:bg-lila-600 selection:text-white font-sans">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        peopleCount={people.length}
        functionsCount={functions.length}
        shiftsCount={shifts.length}
        pendingShirtsCount={pendingShirtsCount}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area with padding for desktop & mobile bottom nav */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-10">
        {/* If user is Staff: Strict Isolation: Only render MI DÍAS */}
        {currentUser?.role === 'staff' && currentUser.staffData ? (
          <StaffShell person={currentUser.staffData} people={people}>
            <StaffMyDiasView
              person={currentUser.staffData}
              assignments={assignments}
              attendances={attendances}
              shifts={shifts}
              events={events}
              bases={bases}
              onLogout={handleLogout}
            />
          </StaffShell>
        ) : currentUser?.role === 'admin' ? (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                people={people}
                assignments={assignments}
                availabilities={availabilities}
                attendances={attendances}
                shifts={shifts}
                bases={bases}
                onNavigate={setCurrentTab}
                onOpenAddPerson={() => {
                  setCurrentTab('people');
                  setIsAddPersonModalOpen(true);
                }}
                onOpenExcelImport={() => setIsExcelModalOpen(true)}
              />
            )}

            {currentTab === 'calendar' && (
              <CalendarView
                mode="admin"
                people={people}
                author={currentUser.adminData?.name || 'Administrador'}
                onOpenConectados={(id) => {
                  setFocusConectadosId(id);
                  setCurrentTab('league');
                }}
              />
            )}

            {currentTab === 'league' && (
              <LeagueView
                mode="admin"
                people={people}
                author={currentUser.adminData?.name || 'Administrador'}
                focusConectadosId={focusConectadosId}
                onFocusHandled={() => setFocusConectadosId(null)}
              />
            )}

            {currentTab === 'people' && (
              <PeopleView
                people={people}
                functions={functions}
                shifts={shifts}
                availabilities={availabilities}
                assignments={assignments}
                isAddModalOpen={isAddPersonModalOpen}
                setIsAddModalOpen={setIsAddPersonModalOpen}
              />
            )}

            {currentTab === 'config' && (
              <ConfigurationView
                shifts={shifts}
                events={events}
                bases={bases}
                functions={functions}
                people={people}
                assignments={assignments}
                currentUserRole={currentUser?.role}
                onNavigateToFunctions={() => setCurrentTab('functions')}
              />
            )}

            {currentTab === 'functions' && (
              <FunctionsView
                functions={functions}
                people={people}
                assignments={assignments}
              />
            )}

            {currentTab === 'assignments' && (
              <AssignmentView
                people={people}
                assignments={assignments}
                availabilities={availabilities}
                functions={functions}
                requirements={requirements}
                shifts={shifts}
                events={events}
                bases={bases}
                onNavigateToConfig={() => setCurrentTab('config')}
              />
            )}

            {currentTab === 'availability' && (
              <AvailabilityView
                people={people}
                availabilities={availabilities}
                shifts={shifts}
                assignments={assignments}
                onNavigate={(tab) => setCurrentTab(tab as TabType)}
              />
            )}

            {currentTab === 'attendance' && (
              <AttendanceView
                shifts={shifts}
                people={people}
                assignments={assignments}
                attendances={attendances}
              />
            )}

            {currentTab === 'food' && (
              <FoodView
                people={people}
                assignments={assignments}
                shifts={shifts}
                events={events}
              />
            )}

            {currentTab === 'food_control' && (
              <FoodControlView
                people={people}
                assignments={assignments}
                shifts={shifts}
                events={events}
              />
            )}

            {currentTab === 'shirts' && (
              <ShirtsView people={people} />
            )}
          </>
        ) : (
          /* If not logged in */
          <div className="max-w-md mx-auto my-12 p-8 sm:p-10 bg-surface border-2 border-tinta-200 rounded-3xl text-center space-y-5 shadow-sm">
            <DiasLogo variant="light" className="h-20 w-auto mx-auto" />

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-tinta-900 tracking-wider">
                PORTAL DÍAS EAFIT 2027
              </h2>
              <p className="text-tinta-500 text-xs sm:text-sm font-sans leading-relaxed">
                Ingresa con tus credenciales como <b>Staff (Mi DÍAS)</b> o como <b>Administrador</b> para acceder al sistema.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full px-8 py-3.5 rounded-2xl bg-lila-600 hover:bg-lila-700 font-display text-white font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 mx-auto text-sm cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>INGRESAR AHORA</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-tinta-200 bg-surface py-4 text-center text-xs text-tinta-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DiasLogo variant="light" className="h-8 w-auto" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-mostaza-50 text-mostaza-600 font-bold border border-mostaza-300/40">
              EDICIÓN 2027
            </span>
          </div>
          <span className="font-mono text-[11px] text-tinta-400">
            {currentUser?.role === 'staff'
              ? `Sesión Staff: ${currentUser.staffData?.name}`
              : currentUser?.role === 'admin'
              ? 'Sesión Administrador (DIAS2026) • Base de Datos Sincronizada'
              : 'Acceso Seguro • Requiere Autenticación'}
          </span>
        </div>
      </footer>

      <Toaster />

      {qrAction && currentUser && (
        <QrActionModal
          key={qrAction.kind + qrAction.token}
          kind={qrAction.kind}
          token={qrAction.token}
          user={currentUser}
          people={people}
          onClose={() => {
            clearPendingQr();
            setQrAction(null);
          }}
        />
      )}

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        people={people}
        assignments={assignments}
        availabilities={availabilities}
        attendances={attendances}
      />

      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        people={people}
        onLoginSuccess={handleLoginSuccess}
        currentAuthUser={currentUser}
      />

      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        existingPeople={people}
        shifts={shifts}
        onImportComplete={() => {
          setCurrentTab('people');
        }}
      />
    </div>
  );
}
