const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace("{isCarnival && carnivalCategory === 'GAP' && physicalBases.length > 0 && (", "{isDivided && carnivalCategory === 'GAP' && activeShift.hasBases && physicalBases.length > 0 && (");

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed UI bases condition');
