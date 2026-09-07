const fs = require('fs');
let files = [
  'src/components/AssignmentView.tsx',
  'src/components/PeopleView.tsx',
  'src/data/eventStructure.ts',
  'src/services/storageService.ts',
  'src/services/supabaseSync.ts'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix AssignmentView and PeopleView and others
    content = content.replace(/MIÃ‰RCOLES/g, 'MIÉRCOLES');
    content = content.replace(/DISTRIBUCIÃ“N/g, 'DISTRIBUCIÓN');
    content = content.replace(/ASIGNACIÃ“N/g, 'ASIGNACIÓN');
    content = content.replace(/FÃ SICAS/g, 'FÍSICAS');
    
    content = content.replace(/fÃ­sicas/g, 'físicas');
    content = content.replace(/Ãºnicas/g, 'únicas');
    content = content.replace(/â€“/g, '–');
    content = content.replace(/â€”/g, '—');
    content = content.replace(/â€¢/g, '•');
    content = content.replace(/Â·/g, '·');
    content = content.replace(/â†’/g, '→');
    content = content.replace(/â˜…/g, '★');
    content = content.replace(/Â¿/g, '¿');
    content = content.replace(/Ã¡/g, 'á');
    content = content.replace(/Ã©/g, 'é');
    content = content.replace(/Ã­/g, 'í');
    content = content.replace(/Ã³/g, 'ó');
    content = content.replace(/Ãº/g, 'ú');
    content = content.replace(/Ã±/g, 'ñ');
    content = content.replace(/Ã‘/g, 'Ñ');
    content = content.replace(/âœ“/g, '✓');
    
    // Specifically for storageService double encoding
    content = content.replace(/funciÃƒÂ³n/g, 'función');
    content = content.replace(/estÃƒÂ¡/g, 'está');
    content = content.replace(/asignaciÃƒÂ³n/g, 'asignación');
    content = content.replace(/eliminaciÃƒÂ³n/g, 'eliminación');
    content = content.replace(/tambiÃƒÂ©n/g, 'también');
    content = content.replace(/deberÃƒÂ¡n/g, 'deberán');
    content = content.replace(/Ã¢â‚¬â€œ/g, '–');
    
    // Specifically for uppercase broken
    content = content.replace(/TÃ©cnicos/g, 'Técnicos');
    content = content.replace(/ComitÃ©/g, 'Comité');
    content = content.replace(/EspecÃ­ficas/g, 'Específicas');
    
    fs.writeFileSync(file, content, 'utf8');
  }
});
console.log("Fixed encodings");
