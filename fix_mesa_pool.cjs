const fs = require('fs');
let content = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

// Replace the candidate matching logic for MESA
content = content.replace(
`        let matchesGroup = false;
        if (isMesa) {
          matchesGroup = true;
        } else if (activeRequirement) {
          if (activeRequirement.groupType === 'GT') {`,
`        let matchesGroup = false;
        if (activeRequirement) {
          if (activeRequirement.groupType === 'GT') {`
);

fs.writeFileSync('src/components/AssignmentView.tsx', content);
console.log('Fixed candidate pool logic');
