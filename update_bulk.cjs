const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetLoop = `    const preparedTxs: Backcharge[] = [];
    const usedIds = new Set(allIds);

    for (const newTx of newTxs) {
      let nextNum = maxNum + 1;
      let formatCount = String(nextNum).padStart(4, '0');
      let newId = \`BC-\${year}-\${formatCount}\`;

      while (usedIds.has(newId)) {
        nextNum++;
        formatCount = String(nextNum).padStart(4, '0');
        newId = \`BC-\${year}-\${formatCount}\`;
      }

      usedIds.add(newId);
      maxNum = nextNum; // update maxNum for next iteration

      const txObj: Backcharge = {
        ...newTx,
        id: newId,
        created_by: creatorEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),`;

const replaceLoop = `    const preparedTxs: Backcharge[] = [];
    const usedIds = new Set(allIds);

    for (const newTx of newTxs) {
      // 1. DUPLICATE DETECTION: Check if data already exists in database (exact match on key fields)
      const existingMatch = transactions.find(t => 
        t.tanggal === newTx.tanggal &&
        t.customer_name?.toLowerCase() === newTx.customer_name?.toLowerCase() &&
        t.value === newTx.value &&
        t.branch === newTx.branch
      );

      let targetId = '';
      if (existingMatch) {
        // If exists, reuse the existing ID to update (Upsert) it
        targetId = existingMatch.id;
      } else {
        // If new, generate a new ID
        let nextNum = maxNum + 1;
        let formatCount = String(nextNum).padStart(4, '0');
        targetId = \`BC-\${year}-\${formatCount}\`;
  
        while (usedIds.has(targetId)) {
          nextNum++;
          formatCount = String(nextNum).padStart(4, '0');
          targetId = \`BC-\${year}-\${formatCount}\`;
        }
  
        usedIds.add(targetId);
        maxNum = nextNum;
      }

      const txObj: Backcharge = {
        ...(existingMatch || {}), // Merge with existing data so we don't lose old fields like dates
        ...newTx,
        id: targetId,
        created_by: existingMatch ? existingMatch.created_by : creatorEmail,
        created_at: existingMatch ? existingMatch.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),`;

code = code.replace(targetLoop, replaceLoop);

const targetInsert = `        for (let i = 0; i < cleanedPayloads.length; i += batchSize) {
          const batch = cleanedPayloads.slice(i, i + batchSize);
          const { error } = await supabase.from('backcharges').insert(batch);
          if (error) throw error;
        }`;

const replaceInsert = `        for (let i = 0; i < cleanedPayloads.length; i += batchSize) {
          const batch = cleanedPayloads.slice(i, i + batchSize);
          // Use UPSERT so that if ID exists, it updates; if not, it inserts.
          const { error } = await supabase.from('backcharges').upsert(batch, { onConflict: 'id' });
          if (error) throw error;
        }`;

code = code.replace(targetInsert, replaceInsert);

fs.writeFileSync('src/App.tsx', code);
console.log("Successfully updated App.tsx for duplicate detection and upsert.");
