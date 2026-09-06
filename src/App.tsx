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

  // Current session user: defaults to Admin (DIAS2026) or stored session
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const stored = localStorage.getItem(INITIAL_USER_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return {
      role: 'admin',
      adminData: {
        id: 'admin_master',
        username: 'DIAS2026',
        name: 'Dirección General DÍAS EAFIT',
        role: 'admin',
      },
    };
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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

  const handleLoginSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(INITIAL_USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(INITIAL_USER_STORAGE_KEY);
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
              <AvailabilityView people={people} availabilities={availabilities} />
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
          <div className="max-w-lg mx-auto my-12 p-8 bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-[#FEF8EC] border-2 border-[#E5A12E]/40 text-[#B83A24] flex items-center justify-center mx-auto shadow-2xs">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-extrabold font-dalek text-[#182535] tracking-wider">
              SESIÓN NO INICIADA
            </h2>

            <p className="text-[#64748B] text-xs sm:text-sm font-montserrat leading-relaxed">
              Por favor inicia sesión como <b>Administrador (DIAS2026)</b> o como integrante de <b>Staff (con tu usuario y cédula)</b> para acceder al sistema.
            </p>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="mt-4 px-8 py-3 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] font-dalek text-white font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 mx-auto text-sm"
            >
              <UserCheck className="w-4 h-4" />
              <span>INGRESAR AHORA</span>
            </button>
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
              : 'Sesión Administrador (DIAS2026) • Base de Datos Sincronizada'}
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
