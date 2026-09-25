const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // 1. ADD NEW TRANSACTION WORKFLOW (0 D1 Rows Read)
  const handleAddTransaction = async (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;
    const year = new Date().getFullYear();
    let maxNum = 0;
    // Fast in-memory ID generation without D1 queries
    const currentYearPrefix = \`BC-\${year}-\`;
    transactions.forEach(t => {
      if (t.id && t.id.startsWith(currentYearPrefix)) {
        const match = t.id.match(/BC-\\d+-(\\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    const newId = \`BC-\${year}-\${String(nextNum).padStart(4, '0')}\`;
    const creatorEmail = currentUser.email;`;

const replacement = `  const generateNextTransactionId = async (): Promise<string> => {
    const year = new Date().getFullYear();
    let maxNum = 0;

    if (isD1Active) {
      try {
        const res = await executeD1Query(
          "SELECT id FROM backcharges WHERE id LIKE ? ORDER BY id DESC LIMIT 1", 
          [\`BC-\${year}-%\`]
        );
        if (res && res.length > 0) {
          const match = res[0].id.match(/BC-\\d+-(\\d+)/);
          if (match) {
            maxNum = parseInt(match[1], 10);
          }
        }
      } catch (err) {
        console.warn("Failed to get max ID from D1, falling back to local cache", err);
      }
    } 

    if (maxNum === 0) {
      const currentYearPrefix = \`BC-\${year}-\`;
      transactions.forEach(t => {
        if (t.id && t.id.startsWith(currentYearPrefix)) {
          const match = t.id.match(/BC-\\d+-(\\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      });
    }

    const nextNum = maxNum + 1;
    return \`BC-\${year}-\${String(nextNum).padStart(4, '0')}\`;
  };

  // 1. ADD NEW TRANSACTION WORKFLOW (0 D1 Rows Read)
  const handleAddTransaction = async (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;
    const newId = await generateNextTransactionId();
    const creatorEmail = currentUser.email;`;

if (code.includes('const newId = await generateNextTransactionId();\n    let maxNum = 0;')) {
    // We already botched it, let's fix the botched version
    const botchedTarget = `  // 1. ADD NEW TRANSACTION WORKFLOW (0 D1 Rows Read)
  const handleAddTransaction = async (newTx: Omit<Backcharge, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;
    const newId = await generateNextTransactionId();
    let maxNum = 0;
    // Fast in-memory ID generation without D1 queries
    const currentYearPrefix = \`BC-\${year}-\`;
    transactions.forEach(t => {
      if (t.id && t.id.startsWith(currentYearPrefix)) {
        const match = t.id.match(/BC-\\d+-(\\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    const newId = await generateNextTransactionId(); // wait, this was year... \`BC-\${year}-\${String(nextNum).padStart(4, '0')}\`;
    const creatorEmail = currentUser.email;`;
    
    // manual fallback regex replacement
    code = code.replace(/const newId = await generateNextTransactionId\(\);([\s\S]*?)const newId = await generateNextTransactionId\(\);/, 'const year = new Date().getFullYear();$1const newId = `BC-${year}-${String(nextNum).padStart(4, \'0\')}`;');
    
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log('Fixed botched code and replaced target.');
} else {
    // Normal replacement
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log('Replaced target.');
}
