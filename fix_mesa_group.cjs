const fs = require('fs');
let lines = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('let matchesGroup = false;'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('matchesGroup = true;') && lines[i+1].includes('}'));

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `      let matchesGroup = false;
      if (activeRequirement) {
        if (activeRequirement.groupType === 'GT') {
          const isGt = person.primaryType === 'GT';
          const matchesSub =
            !activeRequirement.gtSubTeam ||
            person.gtSubTeam === activeRequirement.gtSubTeam ||
            (person.gtTeams && person.gtTeams.includes(activeRequirement.gtSubTeam));
          matchesGroup = isGt && matchesSub;
        } else if (activeRequirement.groupType === 'GAP') {
          matchesGroup = person.primaryType === 'GAP' || person.primaryType === 'GT';
        } else if (activeRequirement.groupType === 'MESA') {
          matchesGroup = person.primaryType === 'MESA';
        }
      } else {
        matchesGroup = true;
      }`.split('\n');
      
  lines.splice(startIndex, endIndex - startIndex + 2, ...replacement);
  fs.writeFileSync('src/components/AssignmentView.tsx', lines.join('\n'));
  console.log('Fixed matchesGroup');
} else {
  console.log('Not found');
}
