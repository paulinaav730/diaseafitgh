const fs = require('fs');
let c = fs.readFileSync('src/data/eventStructure.ts', 'utf8');
c = c.replace(/isCarnival: event\.isCarnival,/, 'isCarnival: event.isCarnival,\n  isDivided: event.isDivided,');
fs.writeFileSync('src/data/eventStructure.ts', c);
