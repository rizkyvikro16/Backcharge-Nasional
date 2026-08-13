const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "    const isRegionalHead = user.role ? user.role.startsWith('Regional Head') : false;\n    const isDivisionHead = user.role === 'Division Head';\n\n    if ((isRegionalHead || user.role === 'Administrator') && val > 2000000 && val <= 15000000 && (!t.status_approval || t.status_approval === 'Belum Approval')) {",
  "    const isRegionalHead = user.role ? user.role.startsWith('Regional Head') : false;\n    const isDivisionHead = user.role === 'Division Head';\n    const isMaintenance = t.category === 'Maintenance';\n    const isRegionalHeadReq = isMaintenance \n      ? (val > 7500000 && val <= 15000000) \n      : (val > 5000000 && val <= 15000000);\n\n    if ((isRegionalHead || user.role === 'Administrator') && isRegionalHeadReq && (!t.status_approval || t.status_approval === 'Belum Approval')) {"
);

code = code.replace(
  "      const val = t.value || 0;\n      if (val <= 2000000 && (t.category === 'Maintenance' || t.category === 'TPL') && (!t.status_approval || t.status_approval === 'Belum Approval')) {",
  "      const val = t.value || 0;\n      const isMaintenance = t.category === 'Maintenance';\n      const isTPL = t.category === 'TPL';\n      if (((isMaintenance && val <= 7500000) || (isTPL && val <= 5000000)) && (!t.status_approval || t.status_approval === 'Belum Approval')) {"
);

code = code.replace(
  "      const val = t.value || 0;\n      if (val <= 2000000 && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && (!t.status_approval || t.status_approval === 'Belum Approval')) {",
  "      const val = t.value || 0;\n      if (val <= 5000000 && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && (!t.status_approval || t.status_approval === 'Belum Approval')) {"
);

fs.writeFileSync('src/App.tsx', code);
