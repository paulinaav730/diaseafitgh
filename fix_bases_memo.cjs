const fs = require('fs');
let content = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

content = content.replace(
  `if (isDivided && carnivalCategory === 'GAP') {`,
  `if (activeShift?.hasBases || (isDivided && carnivalCategory === 'GAP') || selectedDayId === 'jueves') {`
);

fs.writeFileSync('src/components/AssignmentView.tsx', content);
console.log('Fixed bases memo');
