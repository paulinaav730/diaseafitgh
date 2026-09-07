const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

// 1. the isDivided flag
c = c.replace(/const isCarnival = currentDay\.isCarnival;/, 'const isCarnival = currentDay.isCarnival;\n  const isDivided = currentDay.isDivided;');

// 2. Change {isCarnival && ( to {isDivided && ( for the dedicated architecture panel
c = c.replace(/\{\/\* CARNIVAL DEDICATED ARCHITECTURE PANEL \(If Wednesday\) \*\/\}\n      \{isCarnival && \(/, '{/* CARNIVAL DEDICATED ARCHITECTURE PANEL (If Wednesday) */}\n      {isDivided && (');

// 3. Make the title dynamic
c = c.replace(/MIÉRCOLES • CARNIVAL/g, '{currentDay.dayName.toUpperCase()} • {currentDay.eventName}');
c = c.replace(/DISTRIBUCIÓN OPERATIVA DE CARNIVAL/g, 'DISTRIBUCIÓN OPERATIVA DE {currentDay.eventName.toUpperCase()}');

// 4. Update the buttons to be generic
c = c.replace(/<span>GAP \(3 Turnos \+ 30 Bases\)<\/span>/, '<span>GAP {isCarnival ? "(3 Turnos + 30 Bases)" : "(Bases Físicas)"}</span>');
c = c.replace(/<span>GT \(5 Turnos\)<\/span>/, '<span>GT {isCarnival ? "(5 Turnos)" : "(Soporte General)"}</span>');

// 5. Filter shifts by isDivided instead of isCarnival
c = c.replace(/if \(isCarnival\) \{/g, 'if (isDivided) {');

// 6. Labels in Shifts Selection Bar
c = c.replace(/\{isCarnival \? \`• \$\{carnivalCategory\}\` : \`• \$\{currentDay\.eventName\}\`\}/g, '{isDivided ? `• ${carnivalCategory}` : `• ${currentDay.eventName}`}');
c = c.replace(/\{isCarnival \? \`CARNIVAL \(\$\{carnivalCategory\}\)\` : currentDay\.eventName\}/g, '{isDivided ? `${currentDay.eventName} (${carnivalCategory})` : currentDay.eventName}');

// 7. Make the Visual Blueprint Diagram ONLY show if isCarnival
c = c.replace(/<div className="grid grid-cols-1 md:grid-cols-3 gap-3\.5 pt-1 text-xs font-montserrat">/, '{isCarnival && (\n          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 text-xs font-montserrat">');
c = c.replace(/<\/div>\n        <\/div>\n      \)\}/, '</div>\n          )}\n        </div>\n      )}');

// 8. Physical bases logic override
const replaceBases = `  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
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
  }, [bases, isCarnival, carnivalCategory, selectedDayId, activeShift.id]);`;

const targetBases = `  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
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
  }, [bases, isDivided, selectedDayId, activeShift]);`;

c = c.replace(replaceBases, targetBases);

// 9. TURNO COMPLETO logic 1
const replaceComplete1 = `                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isFull ? 'Cupo Completo' : 'Asignar Personas'}</span>
                    </button>`;
const targetComplete1 = `                      {isFull ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>{isFull ? \`✓ \${(req.gtSubTeam || req.groupType).toUpperCase()} COMPLETO\` : 'Asignar Personas'}</span>
                    </button>`;
c = c.replace(replaceComplete1, targetComplete1);

// 10. TURNO COMPLETO logic 2
const replaceComplete2 = `          <button
            onClick={() => handleOpenAssignModal()}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Asignar Persona a Turno</span>
          </button>`;
const targetComplete2 = `          {(() => {
            const isGeneralShiftFull = currentShiftAssignments.length >= activeShift.capacity;
            return (
              <button
                onClick={() => handleOpenAssignModal()}
                disabled={isGeneralShiftFull}
                className={\`min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider \${
                  isGeneralShiftFull
                    ? 'bg-[#FAF6EC] text-[#94A3B8] border border-[#EADDC7] cursor-not-allowed'
                    : 'bg-[#B83A24] hover:bg-[#9E2F1B] text-white'
                }\`}
              >
                {isGeneralShiftFull ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isGeneralShiftFull ? 'TURNO COMPLETO' : 'Asignar Persona a Turno'}</span>
              </button>
            );
          })()}`;
c = c.replace(replaceComplete2, targetComplete2);

// 11. Fix label capacity
c = c.replace(/\{currentShiftAssignments\.length\} integrante\(s\) asignados a este turno general/, '{currentShiftAssignments.length} / {activeShift.capacity} integrante(s) asignados a este turno general');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Done');
