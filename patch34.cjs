const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  "const isKacabApprover = isKacabRole && (t.category === 'Maintenance' || t.category === 'TPL') && val <= 2000000;",
  "const isMaintenance = t.category === 'Maintenance';\n        const isTPL = t.category === 'TPL';\n        const isKacabApprover = isKacabRole && ((isMaintenance && val <= 7500000) || (isTPL && val <= 5000000));"
);

code = code.replace(
  "const isSalesHeadApprover = isSalesHeadRole && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && val <= 2000000;",
  "const isSalesHeadApprover = isSalesHeadRole && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && val <= 5000000;"
);

code = code.replace(
  "const isRegionalHeadApprover = isRegionalHead && val > 2000000 && val <= 15000000;",
  "const isRegionalHeadApprover = isRegionalHead && ((isMaintenance && val > 7500000 && val <= 15000000) || (!isMaintenance && val > 5000000 && val <= 15000000));"
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
