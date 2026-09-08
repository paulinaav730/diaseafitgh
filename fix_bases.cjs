const fs = require('fs');
let content = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

const regex1 = /if \(\(isDivided && carnivalCategory === 'GAP'\) \|\| activeShift\.hasBases\) \{/g;
content = content.replace(/if \(\(isDivided && carnivalCategory === 'GAP'\) \|\| activeShift\.hasBases\) \{/g, `if (((isDivided || selectedDayId === 'jueves') && carnivalCategory === 'GAP') || activeShift.hasBases) {`);

const regex2 = /isDivided && carnivalCategory === 'GAP' && activeShift\.hasBases/g;
content = content.replace(/isDivided && carnivalCategory === 'GAP' && activeShift\.hasBases/g, `activeShift.hasBases`);

fs.writeFileSync('src/components/AssignmentView.tsx', content);
console.log('Fixed bases logic');
