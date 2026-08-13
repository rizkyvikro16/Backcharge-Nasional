const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(
  "const expectedApproverLabel = \n    txValue > 15000000 ? 'Division Head' :\n    txValue > 2000000 ? 'Regional Head' :\n    (transaction.category === 'Maintenance' || transaction.category === 'TPL') ? 'Kepala Cabang (Kacab)' : 'Sales Head (SH)';",
  "const expectedApproverLabel = \n    txValue > 15000000 ? 'Division Head' :\n    (transaction.category === 'Maintenance' && txValue > 7500000 && txValue <= 15000000) ? 'Regional Head' :\n    (transaction.category !== 'Maintenance' && txValue > 5000000 && txValue <= 15000000) ? 'Regional Head' :\n    (transaction.category === 'Maintenance' || transaction.category === 'TPL') ? 'Kepala Cabang (Kacab)' : 'Sales Head (SH)';"
);

code = code.replace(
  "const isAuthorizedApprover = \n    currentUser.role === 'Administrator' ||\n    (txValue <= 2000000 && (\n      (isKacabRole && (transaction.category === 'Maintenance' || transaction.category === 'TPL')) ||\n      (isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE' || transaction.category === 'Unclaimable Insurance' || transaction.category === 'Dokumen Kendaraan'))\n    )) ||\n    (txValue > 2000000 && txValue <= 15000000 && isRegionalHeadView) ||\n    (txValue > 15000000 && isDivisionHeadView);",
  "const isAuthorizedApprover = \n    currentUser.role === 'Administrator' ||\n    (isKacabRole && ((transaction.category === 'Maintenance' && txValue <= 7500000) || (transaction.category === 'TPL' && txValue <= 5000000))) ||\n    (isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE' || transaction.category === 'Unclaimable Insurance' || transaction.category === 'Dokumen Kendaraan') && txValue <= 5000000) ||\n    (isRegionalHeadView && ((transaction.category === 'Maintenance' && txValue > 7500000 && txValue <= 15000000) || (transaction.category !== 'Maintenance' && txValue > 5000000 && txValue <= 15000000))) ||\n    (isDivisionHeadView && txValue > 15000000);"
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
