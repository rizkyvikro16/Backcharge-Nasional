const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/t\.category === 'Maintenance' \|\| t\.category === 'TPL' \|\| t\.category === 'Unclaimable Insurance' \|\| t\.category === 'Dokumen Kendaraan' \|\| t\.category === 'Unclaimable Insurance' \|\| t\.category === 'Dokumen Kendaraan'/g, `t.category === 'Maintenance' || t.category === 'TPL' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan'`);

// Also add to categoryStats
code = code.replace(`    'TPL': { count: 0, value: 0 }`, `    'TPL': { count: 0, value: 0 },\n    'Unclaimable Insurance': { count: 0, value: 0 },\n    'Dokumen Kendaraan': { count: 0, value: 0 }`);

fs.writeFileSync('src/components/Dashboard.tsx', code);
