const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');
c = c.replace(/onCloseAddModal=\{\(\) => setIsAddPersonModalOpen\(false\)\}/g, 'setIsAddModalOpen={setIsAddPersonModalOpen}');
fs.writeFileSync('src/App.tsx', c);
console.log('Fixed App.tsx');

let p = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');
p = p.replace(/availabilities\?: AvailabilityRecord\[\];\r?\n  isAddModalOpen/, 'availabilities?: AvailabilityRecord[];\n  assignments?: Assignment[];\n  isAddModalOpen');
p = p.replace(/availabilities,\r?\n  isAddModalOpen/, 'availabilities,\n  assignments,\n  isAddModalOpen');
fs.writeFileSync('src/components/PeopleView.tsx', p);
console.log('Fixed PeopleView.tsx props');
