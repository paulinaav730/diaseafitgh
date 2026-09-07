const fs = require('fs');
let content = fs.readFileSync('src/services/excelService.ts', 'utf8');

// 1. Add tipoKey to identifyColumns return type
content = content.replace(
    '    gtKey?: string;\n    shirtSizeKey?: string;',
    '    gtKey?: string;\n    tipoKey?: string;\n    shirtSizeKey?: string;'
);

// 2. Add detection for TIPO
const tipoDetection = `    } else if (norm === 'tipo' || norm === 'type' || norm === 'rol principal' || norm === 'tipo principal') {
      result.tipoKey = hdr;`;

content = content.replace(
    /    \} else if \(\n      norm\.includes\('gt'\) \|\|/,
    `${tipoDetection}\n    } else if (\n      norm.includes('gt') ||`
);

// 3. Process TIPO when parsing rows
// We need to find where gtKey is used and add type processing.
const gtProcessing = `const gtClean = colMap.gtKey ? cleanVal(raw[colMap.gtKey]) : '';`;

const typeProcessing = `const gtClean = colMap.gtKey ? cleanVal(raw[colMap.gtKey]) : '';
    const tipoClean = colMap.tipoKey ? cleanVal(raw[colMap.tipoKey]).toUpperCase() : '';`;

content = content.replace(gtProcessing, typeProcessing);

// Replace the primaryType assignment block
const oldTypeAssignment = `    const isExplicitGap = gtClean.toUpperCase().includes('GAP') || gtClean.toUpperCase().includes('APOYO');
    const isExplicitGt =
      gtClean.toUpperCase().includes('GT') ||
      gtClean.toUpperCase().includes('TRABAJO') ||
      gtClean.toUpperCase().includes('LOGÍSTICA') ||
      gtClean.toUpperCase().includes('LOGISTICA');
    const isMesa = gtClean.toUpperCase().includes('MESA');

    if (isMesa) {
      primaryType = 'MESA';
    } else if (isExplicitGap && isExplicitGt) {
      primaryType = 'GT';
      alsoActsAsGap = true;
      gapRoleDescription = 'GAP Generales (Miércoles, Jueves y Viernes)';
      const cleanedGt = gtClean.replace(/GAP/gi, '').replace(/APOYO/gi, '');
      gtTeams = cleanedGt
        ? cleanedGt.split(/[,/;|\\-]+/).map((s) => s.trim()).filter(Boolean)
        : ['Logística'];
      if (gtTeams.length === 0) gtTeams = ['Logística'];
      gtSubTeam = (gtTeams[0] || 'Logística') as GtSubTeam;
    } else if (isExplicitGap) {
      primaryType = 'GAP';
    } else {
      primaryType = 'GT';
      // Split multiple GT teams: e.g. "Logística, Seguridad"
      gtTeams = gtClean
        ? gtClean.split(/[,/;|]+/).map((s) => s.trim()).filter(Boolean)
        : ['Logística'];
      gtSubTeam = (gtTeams[0] || 'Logística') as GtSubTeam;
    }`;

const newTypeAssignment = `    let explicitType = tipoClean;
    if (explicitType !== 'GT' && explicitType !== 'MESA' && explicitType !== 'GAP') {
      explicitType = '';
    }

    const isExplicitGap = explicitType === 'GAP' || gtClean.toUpperCase().includes('GAP') || gtClean.toUpperCase().includes('APOYO');
    const isExplicitGt =
      explicitType === 'GT' ||
      gtClean.toUpperCase().includes('GT') ||
      gtClean.toUpperCase().includes('TRABAJO') ||
      gtClean.toUpperCase().includes('LOGÍSTICA') ||
      gtClean.toUpperCase().includes('LOGISTICA');
    const isMesa = explicitType === 'MESA' || gtClean.toUpperCase().includes('MESA');

    if (explicitType) {
      primaryType = explicitType as PersonType;
      
      if (primaryType === 'GT') {
        const cleanedGt = gtClean.replace(/GAP/gi, '').replace(/APOYO/gi, '');
        gtTeams = cleanedGt
          ? cleanedGt.split(/[,/;|\\-]+/).map((s) => s.trim()).filter(Boolean)
          : ['Logística'];
        if (gtTeams.length === 0) gtTeams = ['Logística'];
        gtSubTeam = (gtTeams[0] || 'Logística') as GtSubTeam;
      }
      
    } else {
      // Fallback to legacy logic if TIPO column is missing
      if (isMesa) {
        primaryType = 'MESA';
      } else if (isExplicitGap && isExplicitGt) {
        primaryType = 'GT';
        alsoActsAsGap = true;
        gapRoleDescription = 'GAP Generales (Miércoles, Jueves y Viernes)';
        const cleanedGt = gtClean.replace(/GAP/gi, '').replace(/APOYO/gi, '');
        gtTeams = cleanedGt
          ? cleanedGt.split(/[,/;|\\-]+/).map((s) => s.trim()).filter(Boolean)
          : ['Logística'];
        if (gtTeams.length === 0) gtTeams = ['Logística'];
        gtSubTeam = (gtTeams[0] || 'Logística') as GtSubTeam;
      } else if (isExplicitGap) {
        primaryType = 'GAP';
      } else {
        primaryType = 'GT';
        gtTeams = gtClean
          ? gtClean.split(/[,/;|]+/).map((s) => s.trim()).filter(Boolean)
          : ['Logística'];
        gtSubTeam = (gtTeams[0] || 'Logística') as GtSubTeam;
      }
    }`;

content = content.replace(oldTypeAssignment, newTypeAssignment);

// 4. Update the format export to include TIPO
const oldExport = `      '¿A qué GT pertenece?':
        p.primaryType === 'GT'
          ? \`\${p.gtTeams && p.gtTeams.length > 0 ? p.gtTeams.join(', ') : p.gtSubTeam || 'Logística'}\${p.alsoActsAsGap ? ' / GAP Generales' : ''}\`
          : p.primaryType,`;

const newExport = `      'TIPO': p.primaryType,
      'GT':
        p.primaryType === 'GT'
          ? \`\${p.gtTeams && p.gtTeams.length > 0 ? p.gtTeams.join(', ') : p.gtSubTeam || 'Logística'}\${p.alsoActsAsGap ? ' / GAP Generales' : ''}\`
          : '',`;

content = content.replace(oldExport, newExport);

fs.writeFileSync('src/services/excelService.ts', content);
console.log('Fixed excelService');
