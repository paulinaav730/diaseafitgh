import re

with open('src/components/PeopleView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add assignments to props
content = content.replace(
    '  availabilities?: AvailabilityRecord[];\n  isAddModalOpen: boolean;\n  setIsAddModalOpen: (open: boolean) => void;',
    '  availabilities?: AvailabilityRecord[];\n  assignments?: Assignment[];\n  isAddModalOpen: boolean;\n  setIsAddModalOpen: (open: boolean) => void;'
)
content = content.replace(
    '  availabilities,\n  isAddModalOpen,',
    '  availabilities,\n  assignments,\n  isAddModalOpen,'
)

# 2. Add filter states
state_insert = '''  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [gtFilter, setGtFilter] = useState<string>('Todos');
  const [shiftFilter, setShiftFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Activo');'''

content = content.replace(
    "const [searchTerm, setSearchTerm] = useState('');",
    f"const [searchTerm, setSearchTerm] = useState('');\n{state_insert}"
)

# 3. Add filter UI
filter_ui = '''
      {/* GLOBAL FILTERS */}
      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-[#64748B] mb-1.5 ml-1">TIPO</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-[#EADDC7] bg-white text-[#182535] text-sm font-bold focus:border-[#C87F17] focus:ring-4 focus:ring-[#C87F17]/10 transition-all appearance-none cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="GT">GT</option>
              <option value="MESA">MESA</option>
              <option value="GAP">GAP</option>
            </select>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-[#64748B] mb-1.5 ml-1">GT</label>
            <select
              value={gtFilter}
              onChange={(e) => setGtFilter(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-[#EADDC7] bg-white text-[#182535] text-sm font-bold focus:border-[#C87F17] focus:ring-4 focus:ring-[#C87F17]/10 transition-all appearance-none cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {GT_SUBTEAMS.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-[#64748B] mb-1.5 ml-1">TURNO</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-[#EADDC7] bg-white text-[#182535] text-sm font-bold focus:border-[#C87F17] focus:ring-4 focus:ring-[#C87F17]/10 transition-all appearance-none cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {shifts?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-[#64748B] mb-1.5 ml-1">ESTADO</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-[#EADDC7] bg-white text-[#182535] text-sm font-bold focus:border-[#C87F17] focus:ring-4 focus:ring-[#C87F17]/10 transition-all appearance-none cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Activo">Activo</option>
            </select>
          </div>
        </div>
      </div>
'''
content = content.replace(
    '<div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl overflow-hidden shadow-xs">',
    filter_ui + '\n      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl overflow-hidden shadow-xs">'
)

# 4. Filter logic
# We need to find the useMemo for ilteredPeople and replace its inner logic.
filter_pattern = re.compile(r'const filtered = people\.filter\(\(p\) => \{.*?\};\n\n\s*if \(\!matchesName', re.DOTALL)
# Actually, the original is:
#     const filtered = people.filter((p) => {
#       // 1. Global Search Query
#       if (query) {

original_filter_logic = '''const filtered = people.filter((p) => {
      // 1. Global Search Query
      if (query) {'''

new_filter_logic = '''const filtered = people.filter((p) => {
      // GLOBAL FILTERS
      if (typeFilter !== 'Todos' && p.primaryType !== typeFilter) return false;
      
      if (gtFilter !== 'Todos') {
        const personGtTeams = p.gtTeams || (p.gtSubTeam ? [p.gtSubTeam] : []);
        if (!personGtTeams.includes(gtFilter as any)) return false;
      }

      if (shiftFilter !== 'Todos') {
        const personAssignments = assignments?.filter(a => a.personId === p.id) || [];
        if (!personAssignments.some(a => a.shiftId === shiftFilter)) return false;
      }

      if (statusFilter === 'Activo') {
        // Active
      } else if (statusFilter !== 'Todos') {
        return false;
      }

      // 1. Global Search Query
      if (query) {'''

content = content.replace(original_filter_logic, new_filter_logic)

# 5. Table Headers
thead_pattern = re.compile(r'<thead className="bg-\[#FFFDF8\] sticky top-0 z-10">.*?</thead>', re.DOTALL)
new_thead = '''<thead className="bg-[#FFFDF8] sticky top-0 z-10">
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
              </thead>'''
content = thead_pattern.sub(new_thead, content)

# 6. Table Body
tbody_pattern = re.compile(r'<tbody>.*?</tbody>', re.DOTALL)
new_tbody = '''<tbody>
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
                        <span className={inline-block px-2.5 py-1 rounded-md text-[11px] font-bold }>
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
                              if (window.confirm(¿Eliminar a ?)) {
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
            </tbody>'''
content = tbody_pattern.sub(new_tbody, content)

with open('src/components/PeopleView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
