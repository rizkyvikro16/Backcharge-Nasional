const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(`              else if (catName === 'TPL') barColor = "bg-rose-500";`, `              else if (catName === 'TPL') barColor = "bg-rose-500";\n              else if (catName === 'Unclaimable Insurance') barColor = "bg-teal-500";\n              else if (catName === 'Dokumen Kendaraan') barColor = "bg-purple-500";`);

fs.writeFileSync('src/components/Dashboard.tsx', code);
