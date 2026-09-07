const fs = require('fs');
let content = fs.readFileSync('src/components/ExcelImportModal.tsx', 'utf8');

content = content.replace(
  '<th className="py-2.5 px-3">GT / Tipo</th>',
  '<th className="py-2.5 px-3">TIPO</th>\n<th className="py-2.5 px-3">GT</th>'
);

content = content.replace(
  /                      <td className="py-2\.5 px-3 text-\[#475569\]">[\s\S]*?<\/td>/,
  `                      <td className="py-2.5 px-3 text-[#475569]">
                        <span className={\`inline-block px-2 py-0.5 rounded text-[10px] font-bold \${
                          row.primaryType === 'GT' ? 'bg-[#FDF2EE] text-[#B83A24]' :
                          row.primaryType === 'GAP' ? 'bg-[#F0FDF4] text-[#166534]' :
                          'bg-[#EFF6FF] text-[#1D4ED8]'
                        }\`}>
                          {row.primaryType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#475569] text-xs">
                        {row.primaryType === 'GT' ? (
                          <span>{row.gtTeams && row.gtTeams.length > 0 ? row.gtTeams.join(', ') : row.gtSubTeam}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>`
);

fs.writeFileSync('src/components/ExcelImportModal.tsx', content);
console.log('Fixed excel modal');
