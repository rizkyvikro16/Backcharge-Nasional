const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/t\.category === 'Maintenance' \|\| t\.category === 'TPL'/g, `t.category === 'Maintenance' || t.category === 'TPL' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan'`);

fs.writeFileSync('src/App.tsx', code);
