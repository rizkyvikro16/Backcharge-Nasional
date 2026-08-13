const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(
  "({transaction.category === 'Maintenance' || transaction.category === 'TPL' ? 'Kacab' : 'Sales Head'})",
  "({expectedApproverLabel})"
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
