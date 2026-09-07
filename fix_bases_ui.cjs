const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

// Change the physical bases UI rendering to depend on isDivided AND activeShift.hasBases
c = c.replace(/\{isCarnival && carnivalCategory === 'GAP' && physicalBases\.length > 0 && \(/g, '{isDivided && carnivalCategory === "GAP" && activeShift.hasBases && physicalBases.length > 0 && (');
c = c.replace(/\{/\* CONDITIONAL: 30 PHYSICAL BASES FOR CARNIVAL GAP \*\/\}/g, '{/* CONDITIONAL: PHYSICAL BASES FOR GAP */}');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed UI bases condition');
