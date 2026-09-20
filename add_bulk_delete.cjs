const fs = require('fs');
let lines = fs.readFileSync('src/components/AssignmentView.tsx', 'utf8').split('\n');

const stateIndex = lines.findIndex(l => l.includes('const [showOnlyAvailableInModal, setShowOnlyAvailableInModal]'));
if (stateIndex !== -1) {
  lines.splice(stateIndex + 1, 0, `  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);`);
}

const fnIndex = lines.findIndex(l => l.includes('const handleRemoveAssignment = async'));
if (fnIndex !== -1) {
  lines.splice(fnIndex - 1, 0, `
  const handleBulkRemoveAssignments = async () => {
    if (selectedAssignmentIds.length === 0) return;
    if (confirm(\`¿Eliminar las \${selectedAssignmentIds.length} asignaciones seleccionadas?\`)) {
      for (const id of selectedAssignmentIds) {
        await removeAssignment(id);
      }
      setSelectedAssignmentIds([]);
    }
  };

  const toggleSelectAllAssignments = (allIds) => {
    if (selectedAssignmentIds.length === allIds.length) {
      setSelectedAssignmentIds([]);
    } else {
      setSelectedAssignmentIds(allIds);
    }
  };

  const toggleAssignmentSelection = (id) => {
    setSelectedAssignmentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
`);
}

fs.writeFileSync('src/components/AssignmentView.tsx', lines.join('\n'));
console.log('Added states and functions');
