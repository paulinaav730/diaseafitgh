const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

const regex = /const physicalBases: PhysicalBase\[\] = useMemo\(\(\) => \{[\s\S]*?\}, \[.*?\]\);/;
const targetBases = `const physicalBases: PhysicalBase[] = useMemo(() => {
    if (bases && bases.length > 0) {
      if (isDivided && carnivalCategory === 'GAP') {
        const eventIdFilter = selectedDayId === 'miercoles' ? 'carnival' : 'the-games';
        return bases
          .filter((b) => b.isActive && (b.eventId === eventIdFilter || (!b.eventId && selectedDayId === 'miercoles')))
          .map((b) => ({
            baseNumber: b.baseNumber,
            name: b.name,
            suggestedCapacity: b.suggestedCapacity,
            isSpecial: b.isSpecial,
          }));
      }
    }

    if (isDivided && carnivalCategory === 'GAP') {
      if (selectedDayId === 'miercoles') return CARNIVAL_PHYSICAL_BASES; // 30 bases
      if (selectedDayId === 'jueves') return THE_GAMES_JUEVES_BASES || []; // Need to import this
      if (selectedDayId === 'viernes') return THE_GAMES_VIERNES_BASES || []; // Need to import this
    }

    return [];
  }, [bases, isDivided, carnivalCategory, selectedDayId]);`;

c = c.replace(regex, targetBases);

// Add the imports for THE_GAMES_JUEVES_BASES and THE_GAMES_VIERNES_BASES
c = c.replace(/import \{.*?CARNIVAL_PHYSICAL_BASES,.*?\} from '\.\.\/data\/eventStructure';/s, (match) => {
  if (match.includes('THE_GAMES_JUEVES_BASES')) return match;
  return match.replace('CARNIVAL_PHYSICAL_BASES,', 'CARNIVAL_PHYSICAL_BASES,\n  THE_GAMES_JUEVES_BASES,\n  THE_GAMES_VIERNES_BASES,');
});

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed bases logic');
