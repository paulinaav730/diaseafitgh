const fs = require('fs');
let p = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');
p = p.replace(/paginatedPeople\.map\(\(person\) => \{/, 'filteredPeople.map((person) => {');
fs.writeFileSync('src/components/PeopleView.tsx', p);
console.log('Fixed paginatedPeople');
