const fs = require('fs');
let content = fs.readFileSync('src/components/FoodView.tsx', 'utf8').replace(/\r\n/g, '\n');

if (!content.includes('import * as XLSX')) {
  content = content.replace(`import { EVENT_SCHEDULE`, `import * as XLSX from 'xlsx';\nimport { EVENT_SCHEDULE`);
}

const exportFnStr = `
  const handleExportWeeklyExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [];

    // Header row
    const headers = [
      'Documento',
      'Nombre',
      'Grupo / Subequipo',
      'Restricción Alimentaria'
    ];
    EVENT_SCHEDULE.forEach(day => {
      headers.push(\`\${day.dayName} Almuerzos\`);
      headers.push(\`\${day.dayName} Refrigerios\`);
    });
    rows.push(headers);

    people.forEach(person => {
      const primaryType = person.primaryType || 'GT';
      let teamLabel = primaryType;
      if (primaryType === 'GT') {
        teamLabel = \`GT: \${person.gtSubTeam || 'Generales'}\`;
      }

      const row = [
        person.documentId || '',
        person.name || '',
        teamLabel,
        person.dietaryRestrictions || 'Ninguna'
      ];

      EVENT_SCHEDULE.forEach(day => {
        // Calculate food for this day
        const activeShifts = (shifts && shifts.length > 0) ? shifts : DEFAULT_INITIAL_SHIFTS;
        const dayShifts = activeShifts.filter((s) => s.dayId === day.dayId && s.isActive);
        
        const personShifts = assignments
          .filter((a) => a.personId === person.id && dayShifts.some(ds => ds.id === a.shiftId))
          .map((a) => {
            const shiftDef = dayShifts.find((sh) => sh.id === a.shiftId);
            return {
              ...a,
              startTime: shiftDef?.startTime || '00:00',
              endTime: shiftDef?.endTime || '00:00',
            };
          });

        let totalHours = 0;
        personShifts.forEach((s) => {
          const parseTime = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h + (m || 0) / 60;
          };
          const start = parseTime(s.startTime);
          let end = parseTime(s.endTime);
          if (end < start) end += 24;
          totalHours += (end - start);
        });

        let lunches = 0;
        let snacks = 0;

        if (totalHours >= 9) {
          lunches = 1;
          snacks = 2;
        } else if (totalHours >= 6) {
          lunches = 1;
          snacks = 1;
        } else if (totalHours >= 3) {
          lunches = 0;
          snacks = 1;
        }

        row.push(lunches);
        row.push(snacks);
      });

      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Alimentación Semanal");
    XLSX.writeFile(wb, "alimentacion_semanal.xlsx");
  };
`;

const insertIndex = content.indexOf('const handleExportCsv');
content = content.slice(0, insertIndex) + exportFnStr + '\n  ' + content.slice(insertIndex);


const buttonTarget = `<button
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] border border-[#F6C7BA] transition-all flex items-center gap-1.5 shadow-2xs font-montserrat cursor-pointer"
            title="Descargar reporte en formato CSV / Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>`;

const newButtons = `<button
            onClick={handleExportWeeklyExcel}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#16A34A] bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#BBF7D0] transition-all flex items-center gap-1.5 shadow-2xs font-montserrat cursor-pointer"
            title="Descargar Excel semanal de alimentación"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Semana (Excel)</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] border border-[#F6C7BA] transition-all flex items-center gap-1.5 shadow-2xs font-montserrat cursor-pointer"
            title="Descargar CSV del día seleccionado"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Día (CSV)</span>
          </button>`;

content = content.replace(buttonTarget, newButtons);

fs.writeFileSync('src/components/FoodView.tsx', content);
console.log('done weekly export');
