import re

with open('src/components/AssignmentView.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('const isCarnival = currentDay.isCarnival;', 'const isCarnival = currentDay.isCarnival;\n  const isDivided = currentDay.isDivided;')

c = c.replace('{/* CARNIVAL DEDICATED ARCHITECTURE PANEL (If Wednesday) */}\n      {isCarnival && (', '{/* DEDICATED ARCHITECTURE PANEL */}\n      {isDivided && (')

c = c.replace('MIÉRCOLES • CARNIVAL', '{currentDay.dayName.toUpperCase()} • {currentDay.eventName}')
c = c.replace('DISTRIBUCIÓN OPERATIVA DE CARNIVAL', 'DISTRIBUCIÓN OPERATIVA DE {currentDay.eventName.toUpperCase()}')

c = c.replace('<span>GAP (3 Turnos + 30 Bases)</span>', '<span>GAP {isCarnival ? "(3 Turnos + 30 Bases)" : "(Bases Físicas)"}</span>')
c = c.replace('<span>GT (5 Turnos)</span>', '<span>GT {isCarnival ? "(5 Turnos)" : "(Soporte General)"}</span>')

c = c.replace('if (isCarnival) {', 'if (isDivided) {')

c = c.replace('{isCarnival ? •  : • }', '{isDivided ? •  : • }')
c = c.replace('{isCarnival ? CARNIVAL () : currentDay.eventName}', '{isDivided ? ${currentDay.eventName} () : currentDay.eventName}')

c = c.replace('<div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 text-xs font-montserrat">', '{isCarnival && (\n          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 text-xs font-montserrat">')
c = c.replace('          </div>\n        </div>\n      )}', '          </div>\n          )}\n        </div>\n      )}')

# physicalBases
replace_bases = '''  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
  const physicalBases: PhysicalBase[] = useMemo(() => {
    if (bases && bases.length > 0) {
      if (isCarnival) {
        if (carnivalCategory === 'GAP') {
          return bases
            .filter((b) => b.isActive && (b.eventId === 'carnival' || !b.eventId))
            .map((b) => ({
              baseNumber: b.baseNumber,
              name: b.name,
              suggestedCapacity: b.suggestedCapacity,
              isSpecial: b.isSpecial,
            }));
        }
      } else if (
        (selectedDayId === 'jueves' && activeShift.id === 'jueves-t2') ||
        (selectedDayId === 'viernes' && activeShift.id === 'viernes-gap')
      ) {
        return bases
          .filter((b) => b.isActive && b.eventId === 'the-games')
          .map((b) => ({
            baseNumber: b.baseNumber,
            name: b.name,
            suggestedCapacity: b.suggestedCapacity,
            isSpecial: b.isSpecial,
          }));
      }
    }

    if (isCarnival) {
      if (carnivalCategory === 'GAP') {
        return CARNIVAL_PHYSICAL_BASES; // Exactly 30 bases
      }
    } else if (
      (selectedDayId === 'jueves' && activeShift.id === 'jueves-t2') ||
      (selectedDayId === 'viernes' && activeShift.id === 'viernes-gap')
    ) {
      return THE_GAMES_PHYSICAL_BASES; // Exactly 15 bases
    }

    return [];
  }, [bases, isCarnival, carnivalCategory, selectedDayId, activeShift.id]);'''

target_bases = '''  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
  const physicalBases = useMemo(() => {
    if (!bases || bases.length === 0) return [];
    
    // Only return bases for the currently selected day
    const dayBases = bases.filter((b) => b.isActive && b.dayId === selectedDayId);
    
    // Si no es Carnaval ni turno con bases, devolver vacío
    if (!isDivided && !activeShift.hasBases) return [];
    
    return dayBases
      .sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99))
      .map((b) => ({
        id: b.id,
        name: b.name,
        defaultCapacity: b.capacity || 2,
        isSpecial: b.isSpecial,
      }));
  }, [bases, isDivided, selectedDayId, activeShift]);'''

c = c.replace(replace_bases, target_bases)

replace_complete1 = '''                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isFull ? 'Cupo Completo' : 'Asignar Personas'}</span>
                    </button>'''
target_complete1 = '''                      {isFull ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>{isFull ? ✓  COMPLETO : 'Asignar Personas'}</span>
                    </button>'''
c = c.replace(replace_complete1, target_complete1)


replace_complete2 = '''          <button
            onClick={() => handleOpenAssignModal()}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Asignar Persona a Turno</span>
          </button>'''
target_complete2 = '''          {(() => {
            const isGeneralShiftFull = currentShiftAssignments.length >= activeShift.capacity;
            return (
              <button
                onClick={() => handleOpenAssignModal()}
                disabled={isGeneralShiftFull}
                className={min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider }
              >
                {isGeneralShiftFull ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isGeneralShiftFull ? 'TURNO COMPLETO' : 'Asignar Persona a Turno'}</span>
              </button>
            );
          })()}'''
c = c.replace(replace_complete2, target_complete2)

c = c.replace('{currentShiftAssignments.length} integrante(s) asignados a este turno general', '{currentShiftAssignments.length} / {activeShift.capacity} integrante(s) asignados a este turno general')

with open('src/components/AssignmentView.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Python script completed")
