const fs = require('fs');

const path = 'src/services/storageService.ts';
let content = fs.readFileSync(path, 'utf8');

const anchor = '  // Supabase-first: Save to Supabase and confirm before mutating authoritative state';

const validationLogic = \
  // Validation: Check if the base is full
  let maxCapacity = 2; // Fallback
  
  // Try to find the base in basesCache first (which contains user-restored capacities)
  const targetBaseObj = basesCache.find(
    (b) =>
      (resolvedBaseId && b.id === resolvedBaseId) ||
      (rawBaseId && (b.id === rawBaseId || String(b.baseNumber) === String(rawBaseId))) ||
      (rawBaseNumber !== undefined &&
        (String(b.baseNumber) === String(rawBaseNumber) ||
          String(b.id) === String(rawBaseNumber) ||
          b.name.toLowerCase() === String(rawBaseNumber).toLowerCase()))
  );
  
  if (targetBaseObj) {
    maxCapacity = targetBaseObj.defaultCapacity || targetBaseObj.gapCapacity || targetBaseObj.capacity || maxCapacity;
  } else {
    // Fallback to hardcoded arrays if not found in cache
    if (dayId === 'miercoles') {
      const carn = CARNIVAL_PHYSICAL_BASES.find(c => String(c.id) === String(rawBaseId || rawBaseNumber));
      if (carn) maxCapacity = carn.gapCapacity || carn.defaultCapacity || 2;
    } else if (dayId === 'jueves') {
      const gb = THE_GAMES_JUEVES_BASES.find(b => String(b.id) === String(rawBaseId) || String(b.baseNumber) === String(rawBaseNumber || rawBaseId).replace('games_jueves_', ''));
      if (gb) maxCapacity = gb.defaultCapacity || 2;
    } else if (dayId === 'viernes') {
      const gb = THE_GAMES_VIERNES_BASES.find(b => String(b.id) === String(rawBaseId) || String(b.baseNumber) === String(rawBaseNumber || rawBaseId).replace('games_viernes_', ''));
      if (gb) maxCapacity = gb.defaultCapacity || 2;
    }
  }

  const shiftHasBases = currentShift?.hasBases || officialShift?.hasBases;
  if (shiftHasBases && assignedType === 'GAP' && (resolvedBaseId || resolvedBaseNumber !== undefined)) {
    const currentOccupants = assignmentCache.filter(
      (a) =>
        a.dayId === dayId &&
        a.shiftId === shiftId &&
        ((resolvedBaseId && a.baseId === resolvedBaseId) ||
          (resolvedBaseNumber !== undefined && String(a.baseNumber) === String(resolvedBaseNumber)) ||
          (resolvedBaseName && a.baseName === resolvedBaseName)) &&
        a.personId !== personId &&
        a.assignedType === 'GAP'
    );

    if (currentOccupants.length >= maxCapacity) {
      return {
        success: false,
        alertMessage: \\\CUPO COMPLETO: \\\ ya alcanzó su capacidad máxima de \\\ personas en este turno.\\\,
      };
    }
  }

  // Shift total capacity validation
  const isMesaBeingAssigned = assignedType === 'MESA' || person?.primaryType === 'MESA';
  const isMesaShift = currentShift?.category === 'MESA' || officialShift?.category === 'MESA';

  if (!isMesaBeingAssigned) {
    const effectiveCapacity = currentShift?.capacity ?? officialShift?.capacity;
    if (effectiveCapacity) {
      const relevantOccupantsInShift = assignmentCache.filter(
        (a) =>
          a.dayId === dayId &&
          a.shiftId === shiftId &&
          a.personId !== personId &&
          (currentShift?.category === 'GAP' ? a.assignedType === 'GAP' : a.assignedType === 'GT')
      );
      if (relevantOccupantsInShift.length >= effectiveCapacity) {
        return {
          success: false,
          alertMessage: \\\CUPO COMPLETO — Este turno ya alcanzó su capacidad máxima de cupos GT (\\\/\\\).\\\,
        };
      }
    }
  } else if (isMesaShift) {
    const effectiveCapacity = currentShift?.capacity ?? officialShift?.capacity;
    if (effectiveCapacity) {
      const mesaOccupants = assignmentCache.filter(
        (a) =>
          a.dayId === dayId &&
          a.shiftId === shiftId &&
          a.personId !== personId &&
          a.assignedType === 'MESA'
      );
      if (mesaOccupants.length >= effectiveCapacity) {
        return {
          success: false,
          alertMessage: \\\CUPO COMPLETO — Este turno de MESA ya alcanzó su capacidad máxima (\\\/\\\).\\\,
        };
      }
    }
  }

\;

if (!content.includes('CUPO COMPLETO')) {
  content = content.replace(anchor, validationLogic + anchor);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Restored validation in storageService.ts');
} else {
  console.log('Validation already present.');
}
