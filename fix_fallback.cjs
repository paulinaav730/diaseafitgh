const fs = require('fs');
let c = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8');

c = c.replace(/    return isCarnival\r?\n      \? carnivalCategory === 'GAP'\r?\n        \? CARNIVAL_GAP_SHIFTS\r?\n        : carnivalCategory === 'GT'\r?\n        \? CARNIVAL_GT_SHIFTS\r?\n        : \[\.\.\.CARNIVAL_GT_SHIFTS, \.\.\.CARNIVAL_GAP_SHIFTS\]\r?\n      : currentDay\.shifts;/, `    if (isDivided) {
      const baseShifts = isCarnival ? [...CARNIVAL_GT_SHIFTS, ...CARNIVAL_GAP_SHIFTS] : currentDay.shifts;
      if (carnivalCategory === 'GAP') return baseShifts.filter(s => s.category === 'GAP' || s.hasBases);
      if (carnivalCategory === 'GT') return baseShifts.filter(s => s.category === 'GT' && !s.hasBases);
      return baseShifts; // MESA sees all shifts
    }
    return currentDay.shifts;`);

fs.writeFileSync('src/components/AssignmentView.tsx', c);
console.log('Fixed fallback shifts');
