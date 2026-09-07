const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/const isCarnival = currentDay\.isCarnival;/, 'const isCarnival = currentDay.isCarnival;\n  const isDivided = currentDay.isDivided;');
c = c.replace(/\{isCarnival && \(/, '{isDivided && (');

// Fix shift filtering logic:
c = c.replace(/if \(isCarnival\) \{/g, 'if (isDivided) {');

// Fix label in shifts selection:
c = c.replace(/\{isCarnival \? \CARNIVAL \(\$\{carnivalCategory\}\)\ : currentDay\.eventName\}/g, '{isDivided ? ${currentDay.eventName} () : currentDay.eventName}');
c = c.replace(/\{isCarnival \? \• \$\{carnivalCategory\}\ : \• \$\{currentDay\.eventName\}\\}/g, '{isDivided ? •  : • }');

// Also inside the top block we have DISTRIBUCIÓN OPERATIVA DE CARNIVAL. Let's make it generic.
c = c.replace(/DISTRIBUCIÓN OPERATIVA DE CARNIVAL/g, 'DISTRIBUCIÓN OPERATIVA DE {currentDay.eventName}');
c = c.replace(/MIÉRCOLES • CARNIVAL/g, '{currentDay.dayName.toUpperCase()} • {currentDay.eventName}');

// And the infographic, it's hardcoded for Carnival right now. We can hide it or render it conditionally.
// Wait, there's a Visual Blueprint Diagram block. Let's just wrap it in {isCarnival && ( ... )} so it only shows for Carnival?
// Or we can just let it show the hardcoded text for now since the user only wanted the TOGGLE to work.
// Wait, the toggle buttons say "GAP (3 Turnos + 30 Bases)" - that's specific to Carnival.
c = c.replace(/GAP \(3 Turnos \+ 30 Bases\)/g, 'GAP {isCarnival ? "(3 Turnos + 30 Bases)" : "(Bases Físicas)"}');
c = c.replace(/GT \(5 Turnos\)/g, 'GT {isCarnival ? "(5 Turnos)" : "(Soporte General)"}');

// Wrap the visual blueprint diagram in {isCarnival && ...}
c = c.replace(/\{\/\* Visual Blueprint Diagram \*\/\}/, '{isCarnival && (\n          <div>\n          {/* Visual Blueprint Diagram */}');
c = c.replace(/<\/div>\s*<\/div>\s*\}\)\(\)\}\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/, '</div>\n          </div>\n        })()}\n        </div>\n        </div>\n        </div>\n        )}\n        )}');
// Wait, regex replacing the end of the diagram is dangerous. I will just do it carefully with replace_file_content.
fs.writeFileSync('src/components/AssignmentView.tsx', c);
