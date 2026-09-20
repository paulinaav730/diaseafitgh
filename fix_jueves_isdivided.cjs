const fs = require('fs');
let content = fs.readFileSync('src/data/eventStructure.ts', 'utf8');

const regex = /dayId: 'jueves',\s*dayName: 'Jueves',\s*description: '.*?',\s*notes: '.*?',\s*isDivided: true,/g;
content = content.replace(regex, `dayId: 'jueves',\n      dayName: 'Jueves',\n      description: 'Mañana: The Challenge (GT). Tarde: The Games (GAP)',\n      notes: 'Turno T1: GT. Turno T2: GAP.',\n      isDivided: false,`);

fs.writeFileSync('src/data/eventStructure.ts', content);
console.log('Fixed Jueves isDivided regex');
