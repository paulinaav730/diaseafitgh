import React, { useState, useEffect } from 'react';
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
import { DashboardView } from './components/DashboardView';
import { PeopleView } from './components/PeopleView';
import { AssignmentView } from './components/AssignmentView';
import { FunctionsView } from './components/FunctionsView';
import { ConfigurationView } from './components/ConfigurationView';
import { AvailabilityView } from './components/AvailabilityView';
import { AttendanceView } from './components/AttendanceView';
import { FoodView } from './components/FoodView';
import { SettingsModal } from './components/SettingsModal';
import { StaffMyDiasView } from './components/StaffMyDiasView';
import { LoginModal } from './components/LoginModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { isSupabaseConfigured } from './services/supabaseClient';
import { syncAllFromSupabase } from './services/supabaseSync';

const INITIAL_USER_STORAGE_KEY = 'dias_eafit_current_user';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
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
    setCurrentUser(null);
    try {
      localStorage.removeItem(INITIAL_USER_STORAGE_KEY);
      sessionStorage.removeItem(INITIAL_USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FBF8EE] text-[#182535] flex flex-col selection:bg-[#B83A24] selection:text-white font-montserrat">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        peopleCount={people.length}
        functionsCount={functions.length}
        shiftsCount={shifts.length}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area with padding for desktop & mobile bottom nav */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-10">
        {/* If user is Staff: Strict Isolation: Only render MI DÍAS */}
        {currentUser?.role === 'staff' && currentUser.staffData ? (
          <StaffMyDiasView
            person={currentUser.staffData}
            assignments={assignments}
            attendances={attendances}
            shifts={shifts}
            events={events}
            bases={bases}
            onLogout={handleLogout}
          />
        ) : currentUser?.role === 'admin' ? (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                people={people}
                assignments={assignments}
                availabilities={availabilities}
                attendances={attendances}
                onNavigate={setCurrentTab}
                onOpenAddPerson={() => {
                  setCurrentTab('people');
                  setIsAddPersonModalOpen(true);
                }}
                onOpenExcelImport={() => setIsExcelModalOpen(true)}
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
              />
            )}

            {currentTab === 'attendance' && (
              <AttendanceView
                people={people}
                assignments={assignments}
                attendances={attendances}
              />
            )}

            {currentTab === 'food' && (
              <FoodView people={people} assignments={assignments} />
            )}
          </>
        ) : (
          /* If not logged in */
          <div className="max-w-md mx-auto my-12 p-8 sm:p-10 bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl text-center space-y-5 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#FEF8EC] border-2 border-[#E5A12E]/40 text-[#B83A24] flex items-center justify-center mx-auto shadow-2xs">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-dalek text-[#182535] tracking-wider">
                PORTAL DÍAS EAFIT 2026
              </h2>
              <p className="text-[#64748B] text-xs sm:text-sm font-montserrat leading-relaxed">
                Ingresa con tus credenciales como <b>Staff (Mi DÍAS)</b> o como <b>Administrador</b> para acceder al sistema.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full px-8 py-3.5 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] font-dalek text-white font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 mx-auto text-sm cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>INGRESAR AHORA</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EADDC7] bg-[#FFFDF8] py-4 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-dalek tracking-wider text-[#182535] text-sm">DÍAS EAFIT</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FEF8EC] text-[#C87F17] font-bold border border-[#E5A12E]/40">
              EDICIÓN 2026
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#94A3B8]">
            {currentUser?.role === 'staff'
              ? `Sesión Staff: ${currentUser.staffData?.name}`
              : currentUser?.role === 'admin'
              ? 'Sesión Administrador (DIAS2026) • Base de Datos Sincronizada'
              : 'Acceso Seguro • Requiere Autenticación'}
          </span>
        </div>
      </footer>

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
