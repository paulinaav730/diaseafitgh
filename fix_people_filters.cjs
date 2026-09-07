const fs = require('fs');
let p = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');

// 1. Add state variables
const stateInsert = `  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [gtFilter, setGtFilter] = useState<string>('Todos');
  const [shiftFilter, setShiftFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Activo');`;
p = p.replace(/const \[searchTerm, setSearchTerm\] = useState\(''\);/, `const [searchTerm, setSearchTerm] = useState('');\n${stateInsert}`);

// 2. Add filter UI
const filterUI = `
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
`;
p = p.replace(/<div className="bg-\[#FFFDF8\] border-2 border-\[#EADDC7\] rounded-3xl overflow-hidden shadow-xs">/, filterUI + '\n      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl overflow-hidden shadow-xs">');

fs.writeFileSync('src/components/PeopleView.tsx', p);
console.log('Added filters');
