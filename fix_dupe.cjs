const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/  THE_GAMES_JUEVES_BASES,\r?\n  THE_GAMES_VIERNES_BASES,\r?\n  THE_GAMES_JUEVES_BASES,\r?\n  THE_GAMES_VIERNES_BASES,/, '  THE_GAMES_JUEVES_BASES,\n  THE_GAMES_VIERNES_BASES,');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed duplicated imports');
