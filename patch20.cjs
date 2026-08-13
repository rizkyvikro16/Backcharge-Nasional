const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(/t\.category === 'Maintenance' \|\| t\.category === 'TPL'/g, `t.category === 'Maintenance' || t.category === 'TPL' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan'`);

code = code.replace(/item\.category === 'Maintenance' \|\| item\.category === 'TPL'/g, `item.category === 'Maintenance' || item.category === 'TPL' || item.category === 'Unclaimable Insurance' || item.category === 'Dokumen Kendaraan'`);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
