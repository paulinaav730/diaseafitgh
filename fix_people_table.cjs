const fs = require('fs');
let p = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');

// Replace the table headers entirely
const oldTheadStart = /<thead className="bg-\[#FFFDF8\] sticky top-0 z-10">/;
const oldTheadEnd = /<\/thead>/;
const theadContent = p.substring(p.search(oldTheadStart), p.search(oldTheadEnd) + 8);

const newThead = `<thead className="bg-[#FFFDF8] sticky top-0 z-10">
                <tr>
                  <th className="p-3.5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeFilteredSelected;
                      }}
                      onChange={toggleSelectAllFiltered}
                      className="w-4 h-4 rounded text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] cursor-pointer"
                      title={isAllFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos los visibles'}
                    />
                  </th>
                  <th className="p-3.5 text-left font-montserrat text-xs text-[#182535]">NOMBRE</th>
                  <th className="p-3.5 text-left font-montserrat text-xs text-[#182535]">GT</th>
                  <th className="p-3.5 text-left font-montserrat text-xs text-[#182535]">TIPO</th>
                  <th className="p-3.5 text-left font-montserrat text-xs text-[#182535]">TURNOS</th>
                  <th className="p-3.5 text-left font-montserrat text-xs text-[#182535]">ESTADO</th>
                  <th className="p-3.5 text-right font-montserrat text-xs text-[#182535]">ACCIONES</th>
                </tr>
              </thead>`;

p = p.replace(theadContent, newThead);

// Now for tbody
const oldRowStart = /<tr key=\{person\.id\} className="hover:bg-\[#FAF6EC\]\/60 transition-colors">/;
// We need to match up to the end of the tr
// Since we don't know the exact string, let's write a regex that grabs the inside of the tbody.
// Or we can just use string splitting.
const tbodyStart = /<tbody>/;
const tbodyEnd = /<\/tbody>/;
const tbodyContent = p.substring(p.search(tbodyStart), p.search(tbodyEnd) + 8);

const newTbody = `<tbody>
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-[#CBD5E1]" />
                      <p>No se encontraron personas con esos filtros.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPeople.map((person) => {
                  const personAssignments = assignments?.filter(a => a.personId === person.id) || [];
                  const assignedShiftNames = personAssignments.map(a => {
                    const shift = shifts?.find(s => s.id === a.shiftId);
                    return shift ? shift.name : a.shiftId;
                  });

                  return (
                    <tr key={person.id} className="hover:bg-[#FAF6EC]/60 transition-colors">
                      <td className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(person.id)}
                          onChange={() => toggleSelect(person.id)}
                          className="w-4 h-4 rounded text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#FAF6EC] border border-[#EADDC7] text-[#B83A24] font-bold font-dalek flex items-center justify-center shrink-0">
                            {person.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#182535] text-sm group-hover:text-[#B83A24] transition-colors">
                              {person.name}
                            </div>
                            <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                              <span>CC: {person.documentId}</span>
                              {person.email && <span>• {person.email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-[#475569] text-xs">
                        {person.primaryType === 'GT' ? (
                          <div className="font-bold text-[#B83A24]">
                            {person.gtTeams ? person.gtTeams.join(', ') : person.gtSubTeam || '-'}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-4">
                        <span className={\`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold \${
                          person.primaryType === 'GT'
                            ? 'bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]'
                            : person.primaryType === 'GAP'
                            ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                            : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                        }\`}>
                          {person.primaryType}
                        </span>
                        {person.primaryType === 'GT' && person.alsoActsAsGap && (
                          <span className="ml-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#EADDC7]" title={person.gapRoleDescription}>
                            + GAP
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-[#64748B]">
                        {assignedShiftNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedShiftNames.map((shiftName, idx) => (
                              <span key={idx} className="bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-0.5 rounded text-[10px] font-bold">
                                {shiftName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#94A3B8] italic">—</span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-bold text-[#166534]">
                        Activo
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(person)}
                            className="p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] transition-colors"
                            title="Editar persona"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(\`¿Eliminar a \${person.name}?\`)) {
                                handleDeletePeople([person.id]);
                              }
                            }}
                            className="p-2 rounded-xl text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-colors"
                            title="Eliminar persona"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>`;

p = p.replace(tbodyContent, newTbody);

fs.writeFileSync('src/components/PeopleView.tsx', p);
console.log('Fixed table body');
