
(Get-Content src/services/storageService.ts) -replace 'assignmentCache = rawAssignments \? JSON.parse\(rawAssignments\) : \[\];', 'const rawFood = localStorage.getItem(''dias_eafit_food_deliveries''); assignmentCache = rawAssignments ? JSON.parse(rawAssignments) : [];' | Set-Content src/services/storageService.ts

