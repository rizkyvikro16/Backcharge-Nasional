const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(`  status_payment: string; // 'Belum Bayar' | 'Lunas'`, `  status_payment: string; // 'Belum Bayar' | 'Lunas'\n  payment_date?: string | null;`);

fs.writeFileSync('src/types.ts', code);
