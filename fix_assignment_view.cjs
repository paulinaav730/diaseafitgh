const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/const physicalBases: PhysicalBase\[\] = useMemo\(\(\) => \{[\s\S]*?return \[\];\s*\}, \[bases, isCarnival, carnivalCategory, selectedDayId, activeShift\]\);/g, const physicalBases = useMemo(() => {
    if (!bases || bases.length === 0) return [];
    
    // Only return bases for the currently selected day
    const dayBases = bases.filter((b) => b.isActive && b.dayId === selectedDayId);
    
    // Si no es Carnaval ni turno con bases, devolver vacío
    if (!isCarnival && !activeShift.hasBases) return [];
    
    return dayBases
      .sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99))
      .map((b) => ({
        id: b.id,
        name: b.name,
        defaultCapacity: b.capacity || 2,
        isSpecial: b.isSpecial,
      }));
  }, [bases, isCarnival, selectedDayId, activeShift]););

c = c.replace(/<UserCheck className="w-3.5 h-3.5" \/>\s*<span>\{isFull \? 'Cupo Completo' : 'Asignar Personas'\}<\/span>/, {isFull ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>{isFull ? \✓ \ COMPLETO\ : 'Asignar Personas'}</span>);

c = c.replace(/<button\s*onClick=\{\(\) => handleOpenAssignModal\(\)\}\s*className="min-h-\[44px\] flex items-center gap-1\.5 px-4 py-2 rounded-xl text-xs font-bold bg-\[#B83A24\] hover:bg-\[#9E2F1B\] text-white shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider"\s*>\s*<Plus className="w-4 h-4" \/>\s*<span>Asignar Persona a Turno<\/span>\s*<\/button>/, {(() => {
            const isGeneralShiftFull = currentShiftAssignments.length >= activeShift.capacity;
            return (
              <button
                onClick={() => handleOpenAssignModal()}
                disabled={isGeneralShiftFull}
                className={\min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider \\}
              >
                {isGeneralShiftFull ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isGeneralShiftFull ? 'TURNO COMPLETO' : 'Asignar Persona a Turno'}</span>
              </button>
            );
          })()});

c = c.replace(/\{currentShiftAssignments\.length\} integrante\(s\) asignados a este turno general/, '{currentShiftAssignments.length} / {activeShift.capacity} integrante(s) asignados a este turno general');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Modified AssignmentView successfully');
