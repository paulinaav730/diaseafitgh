const fs = require('fs');
let c = fs.readFileSync('src/types.ts', 'utf8');
c = c.replace(/isCarnival\?: boolean;/, 'isCarnival?: boolean;\n  isDivided?: boolean;');
c = c.replace(/isCarnival\?: boolean;/, 'isCarnival?: boolean;\n  isDivided?: boolean;');
fs.writeFileSync('src/types.ts', c);
