const fs = require('fs');
let c = fs.readFileSync('src/data/eventStructure.ts', 'utf8');

// Update Jueves T1 to be GAP
c = c.replace(/id: 'jueves-t1',\r?\n    name: 'T1 - The Challenge',\r?\n    dayId: 'jueves',\r?\n    eventId: 'the-challenge',\r?\n    category: 'GT',/, `id: 'jueves-t1',
    name: 'T1 - Mañana GAP',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GAP',`);
c = c.replace(/label: '6:00 AM – 12:00 PM \(The Challenge\)',/, `label: '6:00 AM – 12:00 PM (Solo GAP)',`);

// Update Jueves T2 to indicate it's GAP with bases
c = c.replace(/name: 'T2 - The Games',\r?\n    dayId: 'jueves',\r?\n    eventId: 'the-challenge',\r?\n    category: 'GAP',/, `name: 'T2 - The Games (GAP)',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GAP',`);

// Insert Jueves T2 GT right after Jueves T2 GAP
const insertGtT2 = `
  {
    id: 'jueves-t2-gt',
    name: 'T2 - The Games (GT)',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GT',
    startTime: '13:00',
    endTime: '21:00',
    label: '1:00 PM – 9:00 PM (GT)',
    capacity: 25,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },`;

c = c.replace(/(id: 'jueves-t2',[\s\S]*?forTypes: \['GAP', 'GT', 'MESA'\],\r?\n  \},)/, `$1${insertGtT2}`);

// Update Viernes shift names to include T1
c = c.replace(/name: 'GT General',\r?\n    dayId: 'viernes',/, `name: 'T1 - GT General',
    dayId: 'viernes',`);
c = c.replace(/name: 'GAP Bases',\r?\n    dayId: 'viernes',/, `name: 'T1 - GAP Bases',
    dayId: 'viernes',`);

fs.writeFileSync('src/data/eventStructure.ts', c);
console.log('Fixed event structure');
