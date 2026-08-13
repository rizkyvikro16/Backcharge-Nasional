const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(`      if ((t.category === 'Maintenance' || t.category === 'TPL' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && (!t.status_approval || t.status_approval === 'Belum Approval')) {`, `      const val = t.value || 0;
      if (val <= 2000000 && (t.category === 'Maintenance' || t.category === 'TPL' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && (!t.status_approval || t.status_approval === 'Belum Approval')) {`);

code = code.replace(`      if ((t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE') && (!t.status_approval || t.status_approval === 'Belum Approval')) {`, `      const val = t.value || 0;
      if (val <= 2000000 && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE') && (!t.status_approval || t.status_approval === 'Belum Approval')) {`);

fs.writeFileSync('src/App.tsx', code);
