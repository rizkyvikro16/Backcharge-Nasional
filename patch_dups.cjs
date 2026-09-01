const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `      // 1. DUPLICATE DETECTION: Check if data already exists in database (exact match on key fields)
      const existingMatch = transactions.find(t => 
        t.tanggal === newTx.tanggal &&
        t.customer_name?.toLowerCase() === newTx.customer_name?.toLowerCase() &&
        t.value === newTx.value &&
        t.branch === newTx.branch
      );`;

const replaceStr = `      // 1. DUPLICATE DETECTION: Check if data already exists in database (exact match on key fields)
      const existingMatch = transactions.find(t => 
        t.tanggal === newTx.tanggal &&
        t.customer_name?.toLowerCase() === newTx.customer_name?.toLowerCase() &&
        t.value === newTx.value &&
        t.branch === newTx.branch &&
        (t.license_plate || '').toLowerCase() === (newTx.license_plate || '').toLowerCase() &&
        (t.no_bak || '').toLowerCase() === (newTx.no_bak || '').toLowerCase() &&
        (t.no_spk || '').toLowerCase() === (newTx.no_spk || '').toLowerCase()
      );`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Successfully patched duplicate detection');
} else {
  console.log('Target string not found');
}
