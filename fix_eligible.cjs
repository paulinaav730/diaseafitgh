const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/const isEligible =\r?\n        matchesGroup && !isAlreadyAssigned && !conflictingAssignment && matchesFunctions;/, `const isEligible =
        matchesGroup && !isAlreadyAssigned && !conflictingAssignment && matchesFunctions && isAvailableInShift;`);

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed isEligible filter');
