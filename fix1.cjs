const fs = require('fs');

const path = 'src/components/AssignmentView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the bypass with proper logic
content = content.replace(
  '  // Numbers configured in shifts and bases are requirements, not maximum limits.\n  const isBaseFull = false;',
  \  const isBaseFull = useMemo(() => {
    if (!activeShift?.hasBases && !modalBase) return false;
    if (!modalBase && selectedBaseNumber === null) return false;
    const targetObj = modalBase || (selectedBaseNumber !== null
      ? (physicalBases.find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)) ||
         [...THE_GAMES_JUEVES_BASES, ...THE_GAMES_VIERNES_BASES].find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)) ||
         CARNIVAL_PHYSICAL_BASES.find((b) => String(b.id) === String(selectedBaseNumber)) ||
         (bases || []).find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)))
      : null);
      
    // The bug was that the database values in \ases\ were ignored if they fell back to the hardcoded ones.
    // However, if the user explicitly restores the bases in the UI, they are in \ases\.
    // We should use the active modalBase's capacity!
    const maxCap = targetObj?.defaultCapacity || targetObj?.gapCapacity || targetObj?.capacity || 2;
    return currentBaseGapOccupants.length >= maxCap;
  }, [activeShift, modalBase, selectedBaseNumber, currentBaseGapOccupants, physicalBases, bases]);\
);

fs.writeFileSync(path, content, 'utf8');
