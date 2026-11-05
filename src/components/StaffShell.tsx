import React, { useEffect, useState } from 'react';
import { CalendarDays, Home, Trophy } from 'lucide-react';
import { Person } from '../types';
import { calendarEvents, reminderPreferences } from '../services/calendarService';
import { startForegroundReminders } from '../services/pushService';
import { CalendarView } from './CalendarView';
import { LeagueView } from './LeagueView';
import { Segmented } from './league/ui';

type StaffTab = 'midias' | 'calendar' | 'league';
const KEY = 'dias_eafit_staff_tab';

/** Navegación del portal de staff: Mi DÍAS, Calendario y DÍAS League (solo lectura). */
export const StaffShell: React.FC<{ person: Person; people: Person[]; children: React.ReactNode }> = ({ person, people, children }) => {
  const [tab, setTab] = useState<StaffTab>(() => {
    try {
      return (localStorage.getItem(KEY) as StaffTab) || 'midias';
    } catch {
      return 'midias';
    }
  });
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
      <div className="flex justify-center">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: 'midias', label: 'Mi DÍAS', icon: Home },
            { id: 'calendar', label: 'Calendario', icon: CalendarDays },
            { id: 'league', label: 'DÍAS League', icon: Trophy },
          ]}
        />
      </div>
      {tab === 'midias' && children}
      {tab === 'calendar' && <CalendarView mode="staff" people={people} person={person} author={person.name} />}
      {tab === 'league' && <LeagueView mode="staff" people={people} person={person} author={person.name} />}
    </div>
  );
};
