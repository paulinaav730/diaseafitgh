const fs = require('fs');
let p = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');

const newFilter = `    const filtered = people.filter((p) => {
      // GLOBAL FILTERS (TIPO, GT, TURNO, ESTADO)
      if (typeFilter !== 'Todos' && p.primaryType !== typeFilter) return false;
      
      if (gtFilter !== 'Todos') {
        const personGtTeams = p.gtTeams || (p.gtSubTeam ? [p.gtSubTeam] : []);
        if (!personGtTeams.includes(gtFilter)) return false;
      }

      if (shiftFilter !== 'Todos' && assignments) {
        const personAssignments = assignments.filter(a => a.personId === p.id);
        if (!personAssignments.some(a => a.shiftId === shiftFilter)) return false;
      }

      if (statusFilter === 'Activo') {
        // Assume everyone is Active
      } else if (statusFilter !== 'Todos') {
        return false;
      }
`;

p = p.replace(/    const filtered = people\.filter\(\(p\) => \{/, newFilter);
fs.writeFileSync('src/components/PeopleView.tsx', p);
console.log('Fixed filter logic');
