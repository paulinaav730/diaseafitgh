const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/CARNIVAL_PHYSICAL_BASES,/, 'CARNIVAL_PHYSICAL_BASES,\n  THE_GAMES_JUEVES_BASES,\n  THE_GAMES_VIERNES_BASES,');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed imports again');
