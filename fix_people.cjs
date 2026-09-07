const fs = require('fs');
let c = fs.readFileSync('src/components/PeopleView.tsx', 'utf8');

const regex = /(<span className="font-semibold text-\[#B83A24\]">\s*\{formGtSubTeams\.length\} de \{GT_SUBTEAMS\.length\} grupos\s*<\/span>\s*<\/div>\s*)(<\/div>)/;
const newBlock = 
                    <div className="pt-3 mt-3 border-t border-[#EADDC7]/70 flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAlsoActsAsGap}
                          onChange={(e) => setFormAlsoActsAsGap(e.target.checked)}
                          className="w-4 h-4 rounded text-[#B83A24] bg-white border-gray-300 focus:ring-[#B83A24]"
                        />
                        <span className="text-xs font-bold text-[#182535]">
                          Este GT también apoya como GAP en The Games/Carnival
                        </span>
                      </label>
                      {formAlsoActsAsGap && (
                        <input
                          type="text"
                          value={formGapRoleDesc}
                          onChange={(e) => setFormGapRoleDesc(e.target.value)}
                          placeholder="Especificar días o rol (Ej. Jueves y Viernes GAP Generales)"
                          className="w-full px-3 py-2 mt-1 rounded-xl bg-white border border-[#EADDC7] text-[11px] text-[#182535] focus:outline-none focus:border-[#B83A24]"
                        />
                      )}
                    </div>
;

c = c.replace(regex, $1);
fs.writeFileSync('src/components/PeopleView.tsx', c);
