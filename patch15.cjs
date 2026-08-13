const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(/category === 'Maintenance' \|\| category === 'ETLE' \|\| category === 'TPL'/g, `category === 'Maintenance' || category === 'ETLE' || category === 'TPL' || category === 'Unclaimable Insurance' || category === 'Dokumen Kendaraan'`);

code = code.replace(/category === 'Maintenance' \? 'SA' : category === 'ETLE' \? 'VRO' : 'SA'/g, `(category === 'Maintenance' || category === 'Unclaimable Insurance' || category === 'Dokumen Kendaraan' || category === 'TPL') ? 'SA' : category === 'ETLE' ? 'VRO' : 'SA'`);

code = code.replace(/kat === 'Maintenance' \|\| kat === 'TPL'/g, `kat === 'Maintenance' || kat === 'TPL' || kat === 'Unclaimable Insurance' || kat === 'Dokumen Kendaraan'`);

code = code.replace(/transaction\.category === 'Maintenance' \|\| transaction\.category === 'TPL'/g, `transaction.category === 'Maintenance' || transaction.category === 'TPL' || transaction.category === 'Unclaimable Insurance' || transaction.category === 'Dokumen Kendaraan'`);

fs.writeFileSync('src/components/DetailModal.tsx', code);
