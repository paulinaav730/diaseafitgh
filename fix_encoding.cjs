const fs = require('fs');
let files = [
  'src/components/AssignmentView.tsx',
  'src/components/PeopleView.tsx',
  'src/data/eventStructure.ts',
  'src/services/storageService.ts',
  'src/services/supabaseSync.ts'
];

const replacements = {
  'Ã“': 'Ó',
  'Ã“': 'Ó',
  'Ã‰': 'É',
  'Ãº': 'ú',
  'Ã­': 'í',
  'Ã³': 'ó',
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã±': 'ñ',
  'Ã‘': 'Ñ',
  'â€¢': '•',
  'Â·': '·',
  'Â¿': '¿',
  'â€œ': '"',
  'â€': '"',
  'â€™': '\'',
  'â€˜': '\'',
  'Ã¼': 'ü',
  'Ã': 'í', 
  // be careful with Ã, wait, let's just do exact string replacements
};

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // safe exact replaces
    content = content.replace(/MIÃ‰RCOLES/g, 'MIÉRCOLES');
    content = content.replace(/DISTRIBUCIÃ“N/g, 'DISTRIBUCIÓN');
    content = content.replace(/fÃ­sicas/g, 'físicas');
    content = content.replace(/Ãºnicas/g, 'únicas');
    content = content.replace(/Ã³/g, 'ó');
    content = content.replace(/Ã¡/g, 'á');
    content = content.replace(/Ã©/g, 'é');
    content = content.replace(/Ã­/g, 'í');
    content = content.replace(/Ãº/g, 'ú');
    content = content.replace(/Ã±/g, 'ñ');
    content = content.replace(/Ã‘/g, 'Ñ');
    content = content.replace(/â€¢/g, '•');
    content = content.replace(/Â·/g, '·');
    content = content.replace(/Â¿/g, '¿');
    content = content.replace(/Ã“/g, 'Ó');
    content = content.replace(/Ã‰/g, 'É');
    content = content.replace(/Ã /g, 'Á');
    content = content.replace(/Ã /g, 'Í'); // Wait, 'Í' is Ã
    
    // Check specific broken words we saw
    content = content.replace(/GuÃ­as/g, 'Guías');
    content = content.replace(/TÃ©cnicos/g, 'Técnicos');
    content = content.replace(/ComitÃ©/g, 'Comité');
    content = content.replace(/EspecÃ­ficas/g, 'Específicas');
    content = content.replace(/pestaÃ±a/g, 'pestaña');
    content = content.replace(/lÃ­der/g, 'líder');
    content = content.replace(/acciÃ³n/g, 'acción');
    content = content.replace(/mÃ³dulo/g, 'módulo');
    content = content.replace(/amplÃ­e/g, 'amplíe');

    fs.writeFileSync(file, content, 'utf8');
  }
});
console.log("Done");
