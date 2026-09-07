const fs = require('fs');
let p = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');

// Replace table headers
p = p.replace(/<th className="p-3\.5 text-right">/, `                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-montserrat text-xs text-[#182535]">Turnos</span>
                    </div>
                  </th>
                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-montserrat text-xs text-[#182535]">Estado</span>
                    </div>
                  </th>
                  <th className="p-3.5 text-right">`);
fs.writeFileSync('src/components/PeopleView.tsx', p);
console.log('Fixed table headers');
