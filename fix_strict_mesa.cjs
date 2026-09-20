const fs = require('fs');
let content = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

const regex = /\s*\/\/ 2\. Compatibility logic:[\s\S]*?isAvailableInShift = true;\n\s*\}/;
content = content.replace(regex, '');

fs.writeFileSync('src/components/AssignmentView.tsx', content);
console.log('Removed compatibility logic');
