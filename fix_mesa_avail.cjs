const fs = require('fs');
let content = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

const regex = /      let isAvailableInShift = Boolean\([\s\S]*?isAvailableInShift = true;\n        }\n      \}/g;

const replacement = `      let isAvailableInShift = Boolean(
        availRecord &&
        Array.isArray(availRecord.shiftIds) &&
        availRecord.shiftIds.includes(activeShift.id)
      );`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/AssignmentView.tsx', content);
console.log('Fixed lines');
