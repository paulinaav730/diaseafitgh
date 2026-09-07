const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/30 Bases Físicas Oficiales/g, '{physicalBases.length} Bases Físicas Oficiales');
c = c.replace(/ASIGNACIÓN DE BASES FÍSICAS CARNIVAL/g, 'ASIGNACIÓN DE BASES FÍSICAS {currentDay.eventName.toUpperCase()}');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed hardcoded bases headers');
