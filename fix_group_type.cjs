const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/isCarnival && carnivalCategory === 'GAP'/g, "isDivided && carnivalCategory === 'GAP'");

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed req group type');
