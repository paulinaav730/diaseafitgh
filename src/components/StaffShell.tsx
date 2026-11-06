import React, { useEffect, useState } from 'react';
import { CalendarDays, Home, IdCard, ScanLine, Trophy } from 'lucide-react';
import { Person } from '../types';
import { calendarEvents, reminderPreferences } from '../services/calendarService';
import { startForegroundReminders } from '../services/pushService';
import { CalendarView } from './CalendarView';
import { LeagueView } from './LeagueView';
import { PersonProfile } from './PersonProfile';
import { btnSecondary, Segmented } from './league/ui';
import { QrScanner } from './league/QrScanner';
import { emitQr } from './league/QrCode';
import { notify } from './league/toast';

type StaffTab = 'midias' | 'perfil' | 'calendar' | 'league';
const KEY = 'dias_eafit_staff_tab';

/** Navegación del portal de staff: Mi DÍAS, Mi perfil, Calendario y DÍAS League (solo lectura). */
export const StaffShell: React.FC<{ person: Person; people: Person[]; children: React.ReactNode }> = ({ person, people, children }) => {
  const [tab, setTab] = useState<StaffTab>(() => {
    try {
      return (localStorage.getItem(KEY) as StaffTab) || 'midias';
    } catch {
      return 'midias';
    }
  });
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  // Recordatorios mientras la app está abierta (con la app cerrada los envía el servidor)
  useEffect(
    () =>
      startForegroundReminders(person.id, () => ({
        events: calendarEvents.getAll(),
        prefs: reminderPreferences.getAll(),
      })),
    [person.id]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-center items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: 'midias', label: 'Mi DÍAS', icon: Home },
            { id: 'perfil', label: 'Mi perfil', icon: IdCard },
            { id: 'calendar', label: 'Calendario', icon: CalendarDays },
            { id: 'league', label: 'DÍAS League', icon: Trophy },
          ]}
        />
        <button className={btnSecondary} onClick={() => setScanning(true)}>
          <ScanLine className="w-4 h-4" /> Escanear QR
        </button>
      </div>
      {tab === 'midias' && children}
      {tab === 'perfil' && <PersonProfile person={person} people={people} mode="staff" />}
      {tab === 'calendar' && <CalendarView mode="staff" people={people} person={person} author={person.name} />}
      {tab === 'league' && <LeagueView mode="staff" people={people} person={person} author={person.name} />}
      {scanning && (
        <QrScanner
          title="Escanear QR"
          subtitle="Escanea el QR de un evento para registrar tu asistencia, o el de una actividad para recibir tus DÍAS POINTS."
          onClose={() => setScanning(false)}
          onResult={(text) => {
            if (emitQr(text)) setScanning(false);
            else notify.error(new Error('Ese código no es un QR de DÍAS.'));
          }}
        />
      )}
    </div>
  );
};
