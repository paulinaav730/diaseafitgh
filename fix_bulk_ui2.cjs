const fs = require('fs');
let content = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

const target1 = `        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCurrentShiftAssignments.map((assign) => {`;

const repl1 = `        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 bg-[#FAF6EC]/50 p-2.5 px-4 rounded-xl border border-[#EADDC7]">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#182535]">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-[#B83A24] focus:ring-[#B83A24]"
                  checked={filteredCurrentShiftAssignments.length > 0 && selectedAssignmentIds.length === filteredCurrentShiftAssignments.length}
                  onChange={() => toggleSelectAllAssignments(filteredCurrentShiftAssignments.map(a => a.id))}
                />
                Seleccionar todos ({filteredCurrentShiftAssignments.length})
              </label>
              {selectedAssignmentIds.length > 0 && (
                <button
                  onClick={handleBulkRemoveAssignments}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#B83A24] hover:bg-[#9E2F1B] text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar {selectedAssignmentIds.length} seleccionados
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCurrentShiftAssignments.map((assign) => {`;

content = content.replace(target1, repl1);

const target2 = `              return (
                <div
                  key={assign.id}
                  className="p-3.5 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-[#182535] truncate">{person?.name || 'Persona'}</div>`;

const repl2 = `              return (
                <div
                  key={assign.id}
                  className={\`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-colors \${selectedAssignmentIds.includes(assign.id) ? 'bg-[#FDF2EE] border-[#B83A24]/40 shadow-sm' : 'bg-[#FAF6EC] border-[#EADDC7]'}\`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-[#B83A24] focus:ring-[#B83A24] cursor-pointer"
                        checked={selectedAssignmentIds.includes(assign.id)}
                        onChange={() => toggleAssignmentSelection(assign.id)}
                      />
                    </div>
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-[#182535] truncate">{person?.name || 'Persona'}</div>`;

content = content.replace(target2, repl2);


const target3 = `                  <button
                    onClick={() => handleRemoveAssignment(assign.id)}
                    className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                    title="Quitar turno"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}`;

const repl3 = `                  </div>
                  <button
                    onClick={() => handleRemoveAssignment(assign.id)}
                    className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                    title="Quitar turno"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          </>
        )}`;

content = content.replace(target3, repl3);

fs.writeFileSync('src/components/AssignmentView.tsx', content);
console.log('done');
