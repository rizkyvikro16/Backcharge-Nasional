const fs = require('fs');

let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(
  "'Wewenang Sales Head (OR, Ekspedisi, ETLE)'",
  "'Wewenang Sales Head (OR, Ekspedisi, ETLE, UI, Dok)'"
);

code = code.replace(
  "Own Risk, Ekspedisi, & ETLE.",
  "Own Risk, Ekspedisi, ETLE, Unclaimable Insurance, & Dokumen Kendaraan."
);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
