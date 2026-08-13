const fs = require('fs');

function replaceFile(path, from, to) {
  let code = fs.readFileSync(path, 'utf8');
  code = code.replace(from, to);
  fs.writeFileSync(path, code);
}

replaceFile('src/components/DatabaseView.tsx', 
  /matchesAuthApproval = matchesAuthApproval && \(t\.category === 'Maintenance' \|\| t\.category === 'TPL' \|\| t\.category === 'Unclaimable Insurance' \|\| t\.category === 'Dokumen Kendaraan'\);/g, 
  "matchesAuthApproval = matchesAuthApproval && (t.category === 'Maintenance' || t.category === 'TPL');"
);
replaceFile('src/components/DatabaseView.tsx', 
  /matchesAuthApproval = matchesAuthApproval && \(t\.category === 'Own Risk' \|\| t\.category === 'Ekspedisi' \|\| t\.category === 'ETLE'\);/g, 
  "matchesAuthApproval = matchesAuthApproval && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan');"
);
replaceFile('src/components/DatabaseView.tsx', 
  /if \(isKacab && \(item\.category === 'Maintenance' \|\| item\.category === 'TPL' \|\| item\.category === 'Unclaimable Insurance' \|\| item\.category === 'Dokumen Kendaraan'\)\) canApproveThisItem = true;/g, 
  "if (isKacab && (item.category === 'Maintenance' || item.category === 'TPL')) canApproveThisItem = true;"
);
replaceFile('src/components/DatabaseView.tsx', 
  /if \(isSH && \(item\.category === 'Own Risk' \|\| item\.category === 'Ekspedisi' \|\| item\.category === 'ETLE'\)\) canApproveThisItem = true;/g, 
  "if (isSH && (item.category === 'Own Risk' || item.category === 'Ekspedisi' || item.category === 'ETLE' || item.category === 'Unclaimable Insurance' || item.category === 'Dokumen Kendaraan')) canApproveThisItem = true;"
);


replaceFile('src/components/Dashboard.tsx', 
  /const isKacabApprover = isKacabRole && \(t\.category === 'Maintenance' \|\| t\.category === 'TPL' \|\| t\.category === 'Unclaimable Insurance' \|\| t\.category === 'Dokumen Kendaraan'\) && val <= 2000000;/g, 
  "const isKacabApprover = isKacabRole && (t.category === 'Maintenance' || t.category === 'TPL') && val <= 2000000;"
);
replaceFile('src/components/Dashboard.tsx', 
  /const isSalesHeadApprover = isSalesHeadRole && \(t\.category === 'Own Risk' \|\| t\.category === 'Ekspedisi' \|\| t\.category === 'ETLE'\) && val <= 2000000;/g, 
  "const isSalesHeadApprover = isSalesHeadRole && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && val <= 2000000;"
);


replaceFile('src/components/DetailModal.tsx', 
  /\(transaction\.category === 'Maintenance' \|\| transaction\.category === 'TPL' \|\| transaction\.category === 'Unclaimable Insurance' \|\| transaction\.category === 'Dokumen Kendaraan'\) \? 'Kepala Cabang \(Kacab\)' : 'Sales Head \(SH\)';/g, 
  "(transaction.category === 'Maintenance' || transaction.category === 'TPL') ? 'Kepala Cabang (Kacab)' : 'Sales Head (SH)';"
);
replaceFile('src/components/DetailModal.tsx', 
  /\(isKacabRole && \(transaction\.category === 'Maintenance' \|\| transaction\.category === 'TPL' \|\| transaction\.category === 'Unclaimable Insurance' \|\| transaction\.category === 'Dokumen Kendaraan'\)\) \|\|/g, 
  "(isKacabRole && (transaction.category === 'Maintenance' || transaction.category === 'TPL')) ||"
);
replaceFile('src/components/DetailModal.tsx', 
  /\(isSalesHeadRole && \(transaction\.category === 'Own Risk' \|\| transaction\.category === 'Ekspedisi' \|\| transaction\.category === 'ETLE'\)\)/g, 
  "(isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE' || transaction.category === 'Unclaimable Insurance' || transaction.category === 'Dokumen Kendaraan'))"
);
replaceFile('src/components/DetailModal.tsx', 
  /\(\{transaction\.category === 'Maintenance' \|\| transaction\.category === 'TPL' \|\| transaction\.category === 'Unclaimable Insurance' \|\| transaction\.category === 'Dokumen Kendaraan' \? 'Kacab' : 'Sales Head'\}\)/g, 
  "({transaction.category === 'Maintenance' || transaction.category === 'TPL' ? 'Kacab' : 'Sales Head'})"
);

replaceFile('src/App.tsx', 
  /if \(val <= 2000000 && \(t\.category === 'Maintenance' \|\| t\.category === 'TPL' \|\| t\.category === 'Unclaimable Insurance' \|\| t\.category === 'Dokumen Kendaraan'\) && \(\!t\.status_approval \|\| t\.status_approval === 'Belum Approval'\)\) \{/g, 
  "if (val <= 2000000 && (t.category === 'Maintenance' || t.category === 'TPL') && (!t.status_approval || t.status_approval === 'Belum Approval')) {"
);
replaceFile('src/App.tsx', 
  /if \(val <= 2000000 && \(t\.category === 'Own Risk' \|\| t\.category === 'Ekspedisi' \|\| t\.category === 'ETLE'\) && \(\!t\.status_approval \|\| t\.status_approval === 'Belum Approval'\)\) \{/g, 
  "if (val <= 2000000 && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && (!t.status_approval || t.status_approval === 'Belum Approval')) {"
);

