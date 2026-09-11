import * as XLSX from 'xlsx';
import { Person, PersonType, GtSubTeam, ConfigurableShift, AvailabilityRecord } from '../types';

export interface RecognizedShiftMatch {
  shiftId: string; // The official UUID / turn_id
  shiftName: string; // e.g. "T1", "T4", "GT General"
  timeLabel: string; // e.g. "4:00 PM – 7:30 PM"
  matchedInterval: string; // e.g. "4pm - 7:30pm"
}

export interface UnrecognizedScheduleItem {
  dayId: string;
  dayName: string;
  eventName: string;
  rawText: string;
  normalizedRange: string;
  reason: string;
  rowNumber: number;
  personName: string;
}

export interface ExcelMaestroParsedRow {
  rowNumber: number;
  externalExcelId: string;
  startTimeExcel: string;
  endTimeExcel: string;
  email: string;
  name: string;
  fullName: string;
  phone: string;
  documentId: string;
  username: string;
  institutionalEmail: string;
  epikId: string;
  gt: string;
  shirtSize: string;
  foodAllergies?: string;
  dietaryRestrictions?: string;
  medicalConditions?: string;
  primaryType: PersonType;
  alsoActsAsGap?: boolean;
  gapRoleDescription?: string;
  gtTeams: string[];
  gtSubTeam?: GtSubTeam;
  // Raw text per day
  rawAvailabilityByDay: Record<string, string>;
  // Recognized shifts per day mapped to official turn_id
  recognizedShiftsByDay: Record<string, RecognizedShiftMatch[]>;
  // Unrecognized intervals in this row
  unrecognizedInRow: UnrecognizedScheduleItem[];
  // Duplicate / existing matching
  isExistingPerson: boolean;
  matchedExistingPersonId?: string;
  duplicateReasons: string[];
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export interface ExcelMaestroPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  newPersonsCount: number;
  existingPersonsCount: number;
  duplicateAlertsCount: number;
  recognizedAvailabilitiesCount: number;
  unrecognizedSchedulesCount: number;
  unrecognizedDetails: UnrecognizedScheduleItem[];
  summaryByDay: Record<
    string,
    {
      dayName: string;
      eventName: string;
      recognizedCount: number;
      unrecognizedCount: number;
    }
  >;
  rows: ExcelMaestroParsedRow[];
}

// Backward-compatible interfaces for legacy callers
export interface ExcelImportRow {
  rowNumber: number;
  nombre: string;
  correo: string;
  celular: string;
  cedula: string;
  usuario: string;
  tipo: PersonType | '';
  gt: string;
  funciones: string;
  isValid: boolean;
  isExistingDuplicate: boolean;
  errors: string[];
}

export interface ExcelImportPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  existingDuplicatesCount: number;
  rows: ExcelImportRow[];
}

// Helper to clean string values
export const cleanVal = (val: any): string => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

// Normalize header text for resilient matching
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Event column definitions mapped to standard dayIds
 */
export const EVENT_DAY_COLUMNS: Array<{
  dayId: string;
  dayName: string;
  eventName: string;
  headerPatterns: string[];
}> = [
  {
    dayId: 'lunes',
    dayName: 'Lunes',
    eventName: 'THE SHOW',
    headerPatterns: ['the show', 'show lunes', 'lunes', '28 de septiembre'],
  },
  {
    dayId: 'martes',
    dayName: 'Martes',
    eventName: 'THE ZONE',
    headerPatterns: ['the zone', 'zone martes', 'martes', '29 de septiembre'],
  },
  {
    dayId: 'miercoles',
    dayName: 'Miércoles',
    eventName: 'CARNIVAL',
    headerPatterns: ['carnival', 'carnaval', 'miercoles', '30 de septiembre'],
  },
  {
    dayId: 'jueves',
    dayName: 'Jueves',
    eventName: 'THE CHALLENGE & THE GAMES',
    headerPatterns: ['the challenge', 'challenge', 'the games jueves', 'jueves', '1 de octubre'],
  },
  {
    dayId: 'viernes',
    dayName: 'Viernes',
    eventName: 'THE GAMES',
    headerPatterns: ['the games viernes', 'viernes', '2 de octubre'],
  },
];

/**
 * Parses time string like "4pm", "7:30pm", "08:00 AM", "14:00" into total minutes from midnight (0-1439).
 */
export function parseTimeStringToMinutes(timeStr: string, isPMFallback = false): number | null {
  if (!timeStr) return null;
  const clean = timeStr.toLowerCase().trim();

  // Check explicit AM/PM
  const isPM = clean.includes('pm') || clean.includes('p.m.');
  const isAM = clean.includes('am') || clean.includes('a.m.');

  // Extract digits
  const match = clean.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes >= 60) return null;

  if (isPM) {
    if (hours < 12) hours += 12;
  } else if (isAM) {
    if (hours === 12) hours = 0;
  } else if (isPMFallback) {
    if (hours < 12) hours += 12;
  }

  return hours * 60 + minutes;
}

/**
 * Formats total minutes from midnight into 12-hour AM/PM string, e.g. "4:00 PM"
 */
export function formatMinutesTo12h(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(norm / 60);
  const m = norm % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${h12}:${mm} ${period}`;
}

export interface ParsedInterval {
  startMinutes: number;
  endMinutes: number;
  label: string;
  raw: string;
}

/**
 * Parses a single interval string like "4pm - 7:30pm" or "12:30 PM - 4:00 PM"
 */
export function parseTimeInterval(intervalStr: string): ParsedInterval | null {
  if (!intervalStr) return null;
  const clean = intervalStr.trim();

  // Split by range delimiter (-, –, —, a, to, hasta)
  const parts = clean.split(/\s*(?:–|—|-|\ba\b|\bto\b|\bhasta\b)\s*/i);
  if (parts.length !== 2) {
    return null;
  }

  const rawStart = parts[0].trim();
  const rawEnd = parts[1].trim();

  // Detect whether end is PM and start didn't specify
  const endHasPM = rawEnd.toLowerCase().includes('pm') || rawEnd.toLowerCase().includes('p.m.');
  const startHasAMPM =
    rawStart.toLowerCase().includes('am') ||
    rawStart.toLowerCase().includes('pm') ||
    rawStart.toLowerCase().includes('a.m.') ||
    rawStart.toLowerCase().includes('p.m.');

  let startMin = parseTimeStringToMinutes(rawStart);
  let endMin = parseTimeStringToMinutes(rawEnd);

  if (startMin === null || endMin === null) return null;

  // Infer PM for start if start has no AM/PM, end is PM, and start < end when both are PM
  if (!startHasAMPM && endHasPM) {
    const candidateStartMin = parseTimeStringToMinutes(rawStart, true);
    if (candidateStartMin !== null && candidateStartMin < endMin) {
      startMin = candidateStartMin;
    }
  }

  const label = `${formatMinutesTo12h(startMin)} – ${formatMinutesTo12h(endMin)}`;
  return {
    startMinutes: startMin,
    endMinutes: endMin,
    label,
    raw: clean,
  };
}

/**
 * Splits cell text that may contain multiple intervals separated by semicolon, newline, pipe or comma
 */
export function splitCellIntervals(cellVal: any): string[] {
  if (!cellVal) return [];
  const str = String(cellVal).trim();
  if (!str) return [];

  // Split on ;, newline, |, or double-spaces
  const tokens = str.split(/[;\n|\r]+/).map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const token of tokens) {
    // If token still contains comma and two ranges, handle comma separation
    if (token.includes(',') && (token.includes('-') || token.includes('–'))) {
      const sub = token.split(',').map((s) => s.trim()).filter(Boolean);
      result.push(...sub);
    } else {
      result.push(token);
    }
  }

  return result;
}

/**
 * Converts "HH:MM" (24h) to minutes from midnight
 */
export function time24ToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

/**
 * Matches a parsed interval against configured shifts for that day.
 * Tolerance is +/- 10 minutes to accommodate minor human input discrepancies
 * (e.g. 12:00 vs 12:10, 15:00 vs 15:10).
 */
export function matchIntervalToShift(
  parsed: ParsedInterval,
  rawToken: string,
  configuredShifts: ConfigurableShift[]
): ConfigurableShift | null {
  const rawLower = rawToken.toLowerCase().trim();

  // 1. Direct code/name match (e.g. "T1", "T4", "GT General", "viernes-gt")
  const directMatch = configuredShifts.find((s) => {
    const sName = s.name.toLowerCase();
    const sId = s.id.toLowerCase();
    return (
      rawLower === sName ||
      rawLower === sId ||
      rawLower.startsWith(`${sName} `) ||
      rawLower.startsWith(`${sName}(`) ||
      rawLower.startsWith(`${sName}-`)
    );
  });
  if (directMatch) return directMatch;

  // 2. Numerical minutes match with tolerance
  for (const shift of configuredShifts) {
    if (!shift.isActive) continue;
    const shiftStart = time24ToMinutes(shift.startTime);
    const shiftEnd = time24ToMinutes(shift.endTime);

    const diffStart = Math.abs(parsed.startMinutes - shiftStart);
    const diffEnd = Math.abs(parsed.endMinutes - shiftEnd);

    if (diffStart <= 12 && diffEnd <= 12) {
      return shift;
    }
  }

  return null;
}

/**
 * Identify column meanings from raw row headers
 */
export function identifyColumns(headers: string[]): {
  idKey?: string;
  startTimeKey?: string;
  endTimeKey?: string;
  emailKey?: string;
  nameKey?: string;
  fullNameKey?: string;
  phoneKey?: string;
  documentIdKey?: string;
  usernameKey?: string;
  institutionalEmailKey?: string;
  epikIdKey?: string;
  gtKey?: string;
  shirtSizeKey?: string;
  foodAllergiesKey?: string;
  dietaryRestrictionsKey?: string;
  medicalConditionsKey?: string;
  eventDayKeys: Record<string, string>; // dayId -> original header key
} {
  const result: ReturnType<typeof identifyColumns> = {
    eventDayKeys: {},
  };

  headers.forEach((hdr) => {
    const norm = normalizeHeader(hdr);

    // 1. Event days detection
    for (const def of EVENT_DAY_COLUMNS) {
      if (def.headerPatterns.some((pattern) => norm.includes(pattern))) {
        result.eventDayKeys[def.dayId] = hdr;
        return;
      }
    }

    // 2. Personal fields detection
    if (norm === 'id' || norm === 'external id' || norm === 'id excel') {
      result.idKey = hdr;
    } else if (norm.includes('hora') && norm.includes('inicio')) {
      result.startTimeKey = hdr;
    } else if (norm.includes('hora') && (norm.includes('fin') || norm.includes('finalizacion'))) {
      result.endTimeKey = hdr;
    } else if (
      norm === 'usuario' ||
      norm === 'username' ||
      norm === 'user' ||
      norm === 'login' ||
      norm.includes('nombre de usuario') ||
      norm.includes('usuario eafit') ||
      norm.includes('user eafit') ||
      (norm.includes('usuario') && !norm.includes('hora'))
    ) {
      result.usernameKey = hdr;
    } else if (norm.includes('institucional') || norm.includes('correo inst')) {
      result.institutionalEmailKey = hdr;
    } else if (norm.includes('correo') || norm.includes('email') || norm.includes('mail')) {
      result.emailKey = hdr;
    } else if (
      norm.includes('nombre completo') ||
      (norm.includes('nombre') && (norm.includes('documento') || norm.includes('identificacion')))
    ) {
      result.fullNameKey = hdr;
    } else if (norm.includes('nombre') && !norm.includes('gt')) {
      result.nameKey = hdr;
    } else if (
      norm.includes('celular') ||
      norm.includes('telefono') ||
      norm.includes('phone') ||
      norm.includes('movil')
    ) {
      result.phoneKey = hdr;
    } else if (
      norm.includes('documento') ||
      norm.includes('identidad') ||
      norm.includes('cedula') ||
      norm.includes('dni')
    ) {
      result.documentIdKey = hdr;
    } else if (norm.includes('epik')) {
      result.epikIdKey = hdr;
    } else if (
      norm.includes('gt') ||
      norm.includes('pertenece') ||
      norm.includes('equipo') ||
      norm.includes('subteam')
    ) {
      result.gtKey = hdr;
    } else if (norm.includes('talla') || norm.includes('camiseta') || norm.includes('shirt')) {
      result.shirtSizeKey = hdr;
    } else if (
      norm.includes('alergia') ||
      norm.includes('allergy') ||
      norm.includes('alergeno') ||
      norm.includes('alérgeno')
    ) {
      result.foodAllergiesKey = hdr;
    } else if (
      norm.includes('restriccion') ||
      norm.includes('restricción') ||
      norm.includes('dieta') ||
      norm.includes('dietary') ||
      norm.includes('comida') ||
      norm.includes('alimentar')
    ) {
      result.dietaryRestrictionsKey = hdr;
    } else if (
      norm.includes('enfermedad') ||
      norm.includes('condicion') ||
      norm.includes('condición') ||
      norm.includes('medica') ||
      norm.includes('médica') ||
      norm.includes('medical')
    ) {
      result.medicalConditionsKey = hdr;
    }
  });

  return result;
}

/**
 * Searches for an existing person by Document ID, Username, Institutional Email, EPIK ID, or Personal Email.
 */
export function findExistingPerson(
  rowIdentifiers: {
    documentId: string;
    username?: string;
    institutionalEmail?: string;
    epikId?: string;
    email?: string;
  },
  existingPeople: Person[]
): { existingPerson: Person | null; reasons: string[] } {
  const cleanDoc = rowIdentifiers.documentId.trim();
  const cleanUser = (rowIdentifiers.username || '').trim().toLowerCase().replace(/^@+/, '');
  const cleanInstEmail = (rowIdentifiers.institutionalEmail || '').trim().toLowerCase();
  const cleanEpik = (rowIdentifiers.epikId || '').trim().toLowerCase();
  const cleanEmail = (rowIdentifiers.email || '').trim().toLowerCase();

  const reasons: string[] = [];

  for (const p of existingPeople) {
    const pDoc = p.documentId.trim();
    const pUser = (p.username || '').trim().toLowerCase().replace(/^@+/, '');
    const pInstEmail = (p.institutionalEmail || '').trim().toLowerCase();
    const pEpik = (p.epikId || '').trim().toLowerCase();
    const pEmail = p.email.trim().toLowerCase();

    // 1. Check Document ID
    if (cleanDoc && pDoc === cleanDoc) {
      reasons.push(`Documento de identidad coincidente (${pDoc})`);
      return { existingPerson: p, reasons };
    }

    // 2. Check Username
    if (cleanUser && pUser && pUser === cleanUser) {
      reasons.push(`Nombre de usuario coincidente (@${cleanUser})`);
      return { existingPerson: p, reasons };
    }

    // 3. Check Institutional Email
    if (cleanInstEmail && (pInstEmail === cleanInstEmail || pEmail === cleanInstEmail)) {
      reasons.push(`Correo institucional coincidente (${cleanInstEmail})`);
      return { existingPerson: p, reasons };
    }

    // 4. Check EPIK ID
    if (cleanEpik && pEpik === cleanEpik) {
      reasons.push(`ID de EPIK coincidente (${cleanEpik})`);
      return { existingPerson: p, reasons };
    }

    // 5. Check Personal Email
    if (cleanEmail && (pEmail === cleanEmail || pInstEmail === cleanEmail)) {
      reasons.push(`Correo electrónico coincidente (${cleanEmail})`);
      return { existingPerson: p, reasons };
    }
  }

  return { existingPerson: null, reasons: [] };
}

/**
 * PARSES THE OFFICIAL DÍAS EAFIT EXCEL MAESTRO
 */
export async function parseExcelMaestroFile(
  file: File,
  existingPeople: Person[],
  allConfiguredShifts: ConfigurableShift[]
): Promise<ExcelMaestroPreview> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      newPersonsCount: 0,
      existingPersonsCount: 0,
      duplicateAlertsCount: 0,
      recognizedAvailabilitiesCount: 0,
      unrecognizedSchedulesCount: 0,
      unrecognizedDetails: [],
      summaryByDay: {},
      rows: [],
    };
  }

  // Detect headers from first row keys
  const headerKeys = Object.keys(rawRows[0]);
  const colMap = identifyColumns(headerKeys);

  const parsedRows: ExcelMaestroParsedRow[] = [];
  const seenDocumentsInFile = new Map<string, number>();
  const seenUsersInFile = new Map<string, number>();
  const seenEpikInFile = new Map<string, number>();
  const allUnrecognized: UnrecognizedScheduleItem[] = [];

  const summaryByDay: Record<
    string,
    { dayName: string; eventName: string; recognizedCount: number; unrecognizedCount: number }
  > = {};

  EVENT_DAY_COLUMNS.forEach((def) => {
    summaryByDay[def.dayId] = {
      dayName: def.dayName,
      eventName: def.eventName,
      recognizedCount: 0,
      unrecognizedCount: 0,
    };
  });

  let totalRecognizedAvailabilities = 0;

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // Excel row index
    const errors: string[] = [];
    const warnings: string[] = [];
    const duplicateReasons: string[] = [];

    // Extract core fields
    const externalExcelId = colMap.idKey ? cleanVal(raw[colMap.idKey]) : '';
    const startTimeExcel = colMap.startTimeKey ? cleanVal(raw[colMap.startTimeKey]) : '';
    const endTimeExcel = colMap.endTimeKey ? cleanVal(raw[colMap.endTimeKey]) : '';
    const email = colMap.emailKey ? cleanVal(raw[colMap.emailKey]) : '';
    let name = colMap.nameKey ? cleanVal(raw[colMap.nameKey]) : '';
    const fullName = colMap.fullNameKey ? cleanVal(raw[colMap.fullNameKey]) : '';
    const phone = colMap.phoneKey ? cleanVal(raw[colMap.phoneKey]) : '';
    let documentId = colMap.documentIdKey ? cleanVal(raw[colMap.documentIdKey]) : '';
    let username = colMap.usernameKey ? cleanVal(raw[colMap.usernameKey]) : '';
    const institutionalEmail = colMap.institutionalEmailKey
      ? cleanVal(raw[colMap.institutionalEmailKey])
      : '';
    const epikId = colMap.epikIdKey ? cleanVal(raw[colMap.epikIdKey]) : '';
    const gt = colMap.gtKey ? cleanVal(raw[colMap.gtKey]) : '';
    const shirtSize = colMap.shirtSizeKey ? cleanVal(raw[colMap.shirtSizeKey]).toUpperCase() : 'M';
    const foodAllergies = colMap.foodAllergiesKey ? cleanVal(raw[colMap.foodAllergiesKey]) : '';
    const dietaryRestrictions = colMap.dietaryRestrictionsKey
      ? cleanVal(raw[colMap.dietaryRestrictionsKey])
      : '';
    const medicalConditions = colMap.medicalConditionsKey
      ? cleanVal(raw[colMap.medicalConditionsKey])
      : '';

    // Fallbacks
    if (!name && fullName) {
      name = fullName.split(/\d+/)[0].trim();
    }
    if (!documentId && fullName) {
      const docMatch = fullName.match(/\b(\d{7,11})\b/);
      if (docMatch) {
        documentId = docMatch[1];
      }
    }

    // Clean documentId
    documentId = documentId.replace(/\D/g, '') || documentId;

    // Clean and normalize username (lowercase, remove leading @, remove whitespace)
    username = username.replace(/^@+/, '').trim().toLowerCase().replace(/\s+/g, '');

    // If username was not explicitly provided in Excel, derive it by priority:
    // 1. EPIK ID
    // 2. Institutional Email prefix (before @)
    // 3. Personal Email prefix (before @)
    // 4. Document ID (cédula)
    if (!username) {
      if (epikId && epikId.trim()) {
        username = epikId.trim().toLowerCase().replace(/\s+/g, '').replace(/^@+/, '');
      } else if (institutionalEmail && institutionalEmail.includes('@')) {
        username = institutionalEmail.split('@')[0].trim().toLowerCase().replace(/^@+/, '');
      } else if (email && email.includes('@')) {
        username = email.split('@')[0].trim().toLowerCase().replace(/^@+/, '');
      } else if (documentId) {
        username = documentId.trim();
      }
    }

    if (!name) {
      errors.push('Nombre es obligatorio.');
    }
    if (!documentId) {
      errors.push('Documento de identidad (cédula) es obligatorio.');
    }

    // In-file duplicate checking
    if (documentId) {
      if (seenDocumentsInFile.has(documentId)) {
        duplicateReasons.push(
          `Documento ${documentId} repetido en la fila ${seenDocumentsInFile.get(documentId)}`
        );
        errors.push(`Documento de identidad duplicado en este archivo.`);
      } else {
        seenDocumentsInFile.set(documentId, rowNumber);
      }
    }

    if (username) {
      if (seenUsersInFile.has(username)) {
        warnings.push(`Usuario @${username} repetido en la fila ${seenUsersInFile.get(username)}.`);
      } else {
        seenUsersInFile.set(username, rowNumber);
      }
    }

    if (epikId) {
      if (seenEpikInFile.has(epikId.toLowerCase())) {
        warnings.push(`ID de EPIK ${epikId} repetido en otra fila.`);
      } else {
        seenEpikInFile.set(epikId.toLowerCase(), rowNumber);
      }
    }

    // Determine primaryType and GT teams
    let primaryType: PersonType = 'GT';
    let alsoActsAsGap = false;
    let gapRoleDescription: string | undefined = undefined;
    let gtTeams: string[] = [];
    let gtSubTeam: GtSubTeam | undefined;

    const gtClean = gt.trim();
    const gtUpper = gtClean.toUpperCase();
    const hasGtSubTeam =
      gtUpper.includes('SEGURIDAD') ||
      gtUpper.includes('LOGISTICA') ||
      gtUpper.includes('LOGÍSTICA') ||
      gtUpper.includes('MERCADEO') ||
      gtUpper.includes('MKT') ||
      gtUpper.includes('RRPP') ||
      gtUpper.includes('RELAC') ||
      gtUpper.includes('GENERAL') ||
      gtUpper.includes('THE GAMES') ||
      gtUpper.includes('CARNIVAL') ||
      gtUpper.includes('GH') ||
      gtUpper.includes('GESTION') ||
      gtUpper.includes('GESTIÓN');

    const isExplicitGap =
      gtUpper.includes('GAP') || gtUpper.includes('APOYO');
    const isExplicitGt =
      gtUpper.includes('GT') ||
      gtUpper.includes('TRABAJO') ||
      hasGtSubTeam;
    const isMesa = gtUpper.includes('MESA');

    if (isMesa) {
      primaryType = 'MESA';
    } else if (hasGtSubTeam || (isExplicitGap && isExplicitGt)) {
      primaryType = 'GT';
      if (isExplicitGap) {
        alsoActsAsGap = true;
        gapRoleDescription = 'GAP Generales (Miércoles, Jueves y Viernes)';
      }
      const cleanedGt = gtClean.replace(/GAP/gi, '').replace(/APOYO/gi, '').trim();
      const rawSplits = (cleanedGt || gtClean).split(/[,/;|\-]+/).map((s) => s.trim()).filter(Boolean);
      gtTeams = rawSplits.length > 0 ? rawSplits : ['Logística'];
      // Normalize to known GtSubTeam
      const normalizedSub = gtTeams[0] || 'Logística';
      const normUpper = normalizedSub.toUpperCase();
      if (normUpper.includes('SEGUR')) gtSubTeam = 'Seguridad';
      else if (normUpper.includes('LOGIST')) gtSubTeam = 'Logística';
      else if (normUpper.includes('MERC') || normUpper.includes('MKT')) gtSubTeam = 'Mercadeo';
      else if (normUpper.includes('RRPP') || normUpper.includes('RELAC')) gtSubTeam = 'RRPP';
      else if (normUpper.includes('GH') || normUpper.includes('GESTION') || normUpper.includes('GESTIÓN')) gtSubTeam = 'GH';
      else if (normUpper.includes('CARNIV')) gtSubTeam = 'Carnival';
      else if (normUpper.includes('GAME')) gtSubTeam = 'The Games';
      else if (normUpper.includes('GENER')) gtSubTeam = 'Generales';
      else gtSubTeam = 'Logística';
    } else if (isExplicitGap) {
      primaryType = 'GAP';
    } else {
      primaryType = 'GT';
      // Split multiple GT teams: e.g. "Logística, Seguridad"
      gtTeams = gtClean
        ? gtClean.split(/[,/;|]+/).map((s) => s.trim()).filter(Boolean)
        : ['Logística'];
      gtSubTeam = (gtTeams[0] || 'Logística') as GtSubTeam;
    }

    // Match with existing people in database
    const { existingPerson, reasons } = findExistingPerson(
      { documentId, username, institutionalEmail, epikId, email },
      existingPeople
    );

    const isExistingPerson = !!existingPerson;
    if (isExistingPerson) {
      duplicateReasons.push(...reasons);
    }

    // ---------------- AVAILABILITY PARSING PER DAY ----------------
    const rawAvailabilityByDay: Record<string, string> = {};
    const recognizedShiftsByDay: Record<string, RecognizedShiftMatch[]> = {};
    const unrecognizedInRow: UnrecognizedScheduleItem[] = [];

    EVENT_DAY_COLUMNS.forEach((def) => {
      const dayHeader = colMap.eventDayKeys[def.dayId];
      const cellVal = dayHeader ? cleanVal(raw[dayHeader]) : '';
      rawAvailabilityByDay[def.dayId] = cellVal;
      recognizedShiftsByDay[def.dayId] = [];

      if (!cellVal) return;

      const intervals = splitCellIntervals(cellVal);
      const dayShifts = allConfiguredShifts.filter((s) => s.dayId === def.dayId && s.isActive);

      intervals.forEach((rawInterval) => {
        const parsed = parseTimeInterval(rawInterval);

        if (parsed) {
          const matchedShift = matchIntervalToShift(parsed, rawInterval, dayShifts);
          if (matchedShift) {
            // Avoid duplicate shift in same day
            if (!recognizedShiftsByDay[def.dayId].some((s) => s.shiftId === matchedShift.id)) {
              recognizedShiftsByDay[def.dayId].push({
                shiftId: matchedShift.id,
                shiftName: matchedShift.name,
                timeLabel: matchedShift.label,
                matchedInterval: rawInterval,
              });
              summaryByDay[def.dayId].recognizedCount++;
              totalRecognizedAvailabilities++;
            }
          } else {
            const item: UnrecognizedScheduleItem = {
              dayId: def.dayId,
              dayName: def.dayName,
              eventName: def.eventName,
              rawText: rawInterval,
              normalizedRange: parsed.label,
              reason: `No existe un turno configurado con el horario ${parsed.label} en ${def.eventName}.`,
              rowNumber,
              personName: name || 'Fila ' + rowNumber,
            };
            unrecognizedInRow.push(item);
            allUnrecognized.push(item);
            summaryByDay[def.dayId].unrecognizedCount++;
          }
        } else {
          // Check if user wrote direct shift code like "T1" or "T4" without range
          const directShift = dayShifts.find(
            (s) => s.name.toLowerCase() === rawInterval.toLowerCase()
          );
          if (directShift) {
            if (!recognizedShiftsByDay[def.dayId].some((s) => s.shiftId === directShift.id)) {
              recognizedShiftsByDay[def.dayId].push({
                shiftId: directShift.id,
                shiftName: directShift.name,
                timeLabel: directShift.label,
                matchedInterval: rawInterval,
              });
              summaryByDay[def.dayId].recognizedCount++;
              totalRecognizedAvailabilities++;
            }
          } else {
            const item: UnrecognizedScheduleItem = {
              dayId: def.dayId,
              dayName: def.dayName,
              eventName: def.eventName,
              rawText: rawInterval,
              normalizedRange: rawInterval,
              reason: `Formato de horario no reconocido o sin coincidencia en ${def.eventName}.`,
              rowNumber,
              personName: name || 'Fila ' + rowNumber,
            };
            unrecognizedInRow.push(item);
            allUnrecognized.push(item);
            summaryByDay[def.dayId].unrecognizedCount++;
          }
        }
      });
    });

    // If GT person has recognized GAP shifts (e.g. Carnival GAP or Jueves/Viernes GAP), automatically enable dual role
    if (primaryType === 'GT') {
      const hasGapShifts = Object.values(recognizedShiftsByDay).some((shifts) =>
        shifts.some((s) => s.shiftId.toLowerCase().includes('gap'))
      );
      if (hasGapShifts) {
        alsoActsAsGap = true;
        if (!gapRoleDescription) {
          gapRoleDescription = 'GAP Generales (Miércoles, Jueves y Viernes)';
        }
      }
    }

    if (existingPerson && existingPerson.alsoActsAsGap) {
      alsoActsAsGap = true;
      if (!gapRoleDescription) {
        gapRoleDescription = existingPerson.gapRoleDescription;
      }
    }

    parsedRows.push({
      rowNumber,
      externalExcelId,
      startTimeExcel,
      endTimeExcel,
      email,
      name,
      fullName: fullName || name,
      phone,
      documentId,
      username,
      institutionalEmail,
      epikId,
      gt,
      shirtSize,
      foodAllergies: foodAllergies || (existingPerson?.foodAllergies ?? 'Ninguna'),
      dietaryRestrictions: dietaryRestrictions || (existingPerson?.dietaryRestrictions ?? 'Ninguna'),
      medicalConditions: medicalConditions || (existingPerson?.medicalConditions ?? 'Ninguna'),
      primaryType,
      alsoActsAsGap,
      gapRoleDescription,
      gtTeams,
      gtSubTeam,
      rawAvailabilityByDay,
      recognizedShiftsByDay,
      unrecognizedInRow,
      isExistingPerson,
      matchedExistingPersonId: existingPerson?.id,
      duplicateReasons,
      errors,
      warnings,
      isValid: errors.length === 0,
    });
  });

  const validRows = parsedRows.filter((r) => r.isValid).length;
  const errorRows = parsedRows.filter((r) => !r.isValid).length;
  const existingPersonsCount = parsedRows.filter((r) => r.isExistingPerson).length;
  const newPersonsCount = validRows - existingPersonsCount;
  const duplicateAlertsCount = parsedRows.filter((r) => r.duplicateReasons.length > 0).length;

  return {
    totalRows: parsedRows.length,
    validRows,
    errorRows,
    newPersonsCount: Math.max(0, newPersonsCount),
    existingPersonsCount,
    duplicateAlertsCount,
    recognizedAvailabilitiesCount: totalRecognizedAvailabilities,
    unrecognizedSchedulesCount: allUnrecognized.length,
    unrecognizedDetails: allUnrecognized,
    summaryByDay,
    rows: parsedRows,
  };
}

/**
 * GENERATES OFFICIAL EXCEL MAESTRO TEMPLATE
 * Contains the 17 official columns + realistic sample rows using the EXACT
 * hours of the currently configured active shifts in the system.
 */
export function downloadOfficialExcelMaestroTemplate(configuredShifts: ConfigurableShift[]): void {
  // Find sample hours per day from configured shifts
  const getDaySampleHours = (dayId: string): string => {
    const dayShifts = configuredShifts.filter((s) => s.dayId === dayId && s.isActive);
    if (dayShifts.length === 0) return '';
    // Format first shift or two shifts
    if (dayShifts.length >= 2) {
      return `${dayShifts[0].label}; ${dayShifts[1].label}`;
    }
    return dayShifts[0].label;
  };

  const lunesSample = getDaySampleHours('lunes') || '4:00 PM – 7:30 PM; 7:30 PM – 10:30 PM';
  const martesSample = getDaySampleHours('martes') || '8:30 AM – 12:30 PM';
  const miercolesSample = getDaySampleHours('miercoles') || '8:50 AM – 12:10 PM; 12:00 PM – 3:10 PM';
  const juevesSample = getDaySampleHours('jueves') || '6:00 AM – 12:00 PM';
  const viernesSample = getDaySampleHours('viernes') || '6:00 AM – 9:30 PM';

  const templateRows = [
    {
      ID: '1001',
      'Hora de inicio': '06:00 AM',
      'Hora de finalización': '10:30 PM',
      'Correo electrónico': 'juan.perez@gmail.com',
      Nombre: 'Juan Pérez',
      'Nombre completo (Nombre y documento/identificación)': 'Juan Camilo Pérez Gómez 1017123456',
      'Número de celular': '3001234567',
      'Documento de identidad': '1017123456',
      Usuario: 'jperez',
      'Correo institucional': 'jperez@eafit.edu.co',
      'ID de EPIK': 'EPIK-00129',
      '¿A qué GT pertenece?': 'Logística, Montaje',
      'Talla de camiseta': 'M',
      'Alergias alimentarias': 'Ninguna',
      'Restricción de comidas': 'Vegetariana',
      'Enfermedad o condición médica': 'Ninguna',
      'THE SHOW LUNES 28 de septiembre': lunesSample,
      'THE ZONE MARTES 29 de septiembre': martesSample,
      'CARNIVAL MIÉRCOLES 30 de septiembre': miercolesSample,
      'THE GAMES JUEVES 1 de octubre': juevesSample,
      'THE GAMES VIERNES 2 de octubre': viernesSample,
    },
    {
      ID: '1002',
      'Hora de inicio': '08:00 AM',
      'Hora de finalización': '06:00 PM',
      'Correo electrónico': 'maria.gomez@gmail.com',
      Nombre: 'María Gómez',
      'Nombre completo (Nombre y documento/identificación)': 'María José Gómez López 1020304050',
      'Número de celular': '3017654321',
      'Documento de identidad': '1020304050',
      Usuario: 'mgomez',
      'Correo institucional': 'mgomez@eafit.edu.co',
      'ID de EPIK': 'EPIK-00245',
      '¿A qué GT pertenece?': 'GAP',
      'Talla de camiseta': 'S',
      'Alergias alimentarias': 'Maní, mariscos',
      'Restricción de comidas': 'Sin gluten / Celíaca',
      'Enfermedad o condición médica': 'Asma leve',
      'THE SHOW LUNES 28 de septiembre': '',
      'THE ZONE MARTES 29 de septiembre': '',
      'CARNIVAL MIÉRCOLES 30 de septiembre': '8:50 AM – 12:10 PM; 12:00 PM – 3:10 PM',
      'THE GAMES JUEVES 1 de octubre': '1:00 PM – 9:00 PM',
      'THE GAMES VIERNES 2 de octubre': '7:00 AM – 9:00 PM',
    },
    {
      ID: '1003',
      'Hora de inicio': '07:00 AM',
      'Hora de finalización': '05:00 PM',
      'Correo electrónico': 'carlos.restrepo@gmail.com',
      Nombre: 'Carlos Restrepo',
      'Nombre completo (Nombre y documento/identificación)': 'Carlos Mario Restrepo Ruiz 1033445566',
      'Número de celular': '3129876543',
      'Documento de identidad': '1033445566',
      Usuario: 'crestrepo',
      'Correo institucional': 'crestrepo@eafit.edu.co',
      'ID de EPIK': 'EPIK-00388',
      '¿A qué GT pertenece?': 'RRPP',
      'Talla de camiseta': 'L',
      'Alergias alimentarias': 'Lactosa',
      'Restricción de comidas': 'Ninguna',
      'Enfermedad o condición médica': 'Diabetes tipo 1',
      'THE SHOW LUNES 28 de septiembre': '6:00 AM – 8:00 AM',
      'THE ZONE MARTES 29 de septiembre': '7:00 AM – 12:30 PM',
      'CARNIVAL MIÉRCOLES 30 de septiembre': '',
      'THE GAMES JUEVES 1 de octubre': '6:00 AM – 12:00 PM',
      'THE GAMES VIERNES 2 de octubre': '6:00 AM – 9:30 PM',
    },
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Plantilla Oficial
  const worksheet = XLSX.utils.json_to_sheet(templateRows);
  // Auto column widths
  worksheet['!cols'] = [
    { wch: 8 }, // ID
    { wch: 15 }, // Hora inicio
    { wch: 18 }, // Hora fin
    { wch: 28 }, // Correo
    { wch: 20 }, // Nombre
    { wch: 36 }, // Nombre completo
    { wch: 16 }, // Celular
    { wch: 22 }, // Documento
    { wch: 18 }, // Usuario
    { wch: 26 }, // Correo inst
    { wch: 14 }, // EPIK
    { wch: 24 }, // GT
    { wch: 16 }, // Talla
    { wch: 24 }, // Alergias alimentarias
    { wch: 24 }, // Restricción de comidas
    { wch: 30 }, // Enfermedad o condición médica
    { wch: 34 }, // Lunes
    { wch: 32 }, // Martes
    { wch: 36 }, // Miércoles
    { wch: 32 }, // Jueves
    { wch: 30 }, // Viernes
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'EXCEL MAESTRO DÍAS EAFIT');

  // Sheet 2: Guía de Turnos Oficiales Configurados
  const shiftsGuide = configuredShifts
    .filter((s) => s.isActive)
    .map((s) => ({
      Día: s.dayId.toUpperCase(),
      Evento: s.eventId.toUpperCase(),
      Categoría: s.category,
      'Código Turno': s.name,
      'Horario Exacto': s.label,
      'Hora Inicio (24h)': s.startTime,
      'Hora Fin (24h)': s.endTime,
      'Capacidad Cupos': s.capacity,
    }));

  const guideWorksheet = XLSX.utils.json_to_sheet(shiftsGuide);
  guideWorksheet['!cols'] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 10 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, guideWorksheet, 'TURNOS OFICIALES EN SISTEMA');

  XLSX.writeFile(workbook, 'EXCEL_MAESTRO_DIAS_EAFIT_2026.xlsx');
}

/**
 * EXPORT PEOPLE & AVAILABILITY TO OFFICIAL 18-COLUMN EXCEL MAESTRO
 */
export function exportPeopleToOfficialExcel(
  people: Person[],
  availabilities: AvailabilityRecord[],
  configuredShifts: ConfigurableShift[]
): void {
  const shiftsMap = new Map(configuredShifts.map((s) => [s.id, s]));

  const rows = people.map((p, idx) => {
    // Get availabilities for this person
    const personAvails = availabilities.filter((av) => av.personId === p.id);

    const formatDayShifts = (dayId: string): string => {
      const av = personAvails.find((a) => a.dayId === dayId);
      if (!av || !av.shiftIds || av.shiftIds.length === 0) return '';
      return av.shiftIds
        .map((sId) => shiftsMap.get(sId)?.label || sId)
        .join('; ');
    };

    return {
      ID: p.externalExcelId || String(1000 + idx + 1),
      'Hora de inicio': p.startTimeExcel || '',
      'Hora de finalización': p.endTimeExcel || '',
      'Correo electrónico': p.email,
      Nombre: p.name,
      'Nombre completo (Nombre y documento/identificación)':
        p.fullName || `${p.name} ${p.documentId}`,
      'Número de celular': p.phone || '',
      'Documento de identidad': p.documentId,
      Usuario: p.username || '',
      'Correo institucional': p.institutionalEmail || '',
      'ID de EPIK': p.epikId || '',
      '¿A qué GT pertenece?':
        p.primaryType === 'GT'
          ? `${p.gtTeams && p.gtTeams.length > 0 ? p.gtTeams.join(', ') : p.gtSubTeam || 'Logística'}${p.alsoActsAsGap ? ' / GAP Generales' : ''}`
          : p.primaryType,
      'Talla de camiseta': p.shirtSize || 'M',
      'Alergias alimentarias': p.foodAllergies || 'Ninguna',
      'Restricción de comidas': p.dietaryRestrictions || 'Ninguna',
      'Enfermedad o condición médica': p.medicalConditions || 'Ninguna',
      'THE SHOW LUNES 28 de septiembre': formatDayShifts('lunes'),
      'THE ZONE MARTES 29 de septiembre': formatDayShifts('martes'),
      'CARNIVAL MIÉRCOLES 30 de septiembre': formatDayShifts('miercoles'),
      'THE GAMES JUEVES 1 de octubre': formatDayShifts('jueves'),
      'THE GAMES VIERNES 2 de octubre': formatDayShifts('viernes'),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'EXCEL MAESTRO DÍAS EAFIT');

  XLSX.writeFile(
    workbook,
    `EXCEL_MAESTRO_EXPORT_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}

// ----------------- BACKWARD COMPATIBILITY EXPORTS -----------------
export async function parseExcelFile(
  file: File,
  existingPeople: Person[]
): Promise<ExcelImportPreview> {
  const result = await parseExcelMaestroFile(file, existingPeople, []);
  return {
    totalRows: result.totalRows,
    validRows: result.validRows,
    errorRows: result.errorRows,
    existingDuplicatesCount: result.existingPersonsCount,
    rows: result.rows.map((r) => ({
      rowNumber: r.rowNumber,
      nombre: r.name,
      correo: r.email,
      celular: r.phone,
      cedula: r.documentId,
      usuario: r.username || r.epikId || r.documentId,
      tipo: r.primaryType,
      gt: r.gt,
      funciones: '',
      isValid: r.isValid,
      isExistingDuplicate: r.isExistingPerson,
      errors: r.errors,
    })),
  };
}

export function downloadExcelTemplate(): void {
  downloadOfficialExcelMaestroTemplate([]);
}

export function exportPeopleToExcel(people: Person[]): void {
  exportPeopleToOfficialExcel(people, [], []);
}
