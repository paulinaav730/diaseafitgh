const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/              <\/div>\r?\n            <\/div>\r?\n          <\/div>\r?\n        <\/div>\r?\n      \)\}/, '              </div>\n            </div>\n          </div>\n          )}\n        </div>\n      )}');

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed syntax error');
