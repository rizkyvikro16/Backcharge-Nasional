const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = code.split('\n');

const startIndex = lines.findIndex(l => l.includes('// 1. Fetch backcharges (paginated'));
const endIndex = lines.findIndex(l => l.includes('const unpackedData = allBcData.map(unpackExtraFields);'));

if (startIndex !== -1 && endIndex !== -1) {
  lines.splice(startIndex, endIndex - startIndex + 1, 
`        // 1. Fetch backcharges (Limit to 1500 terbaru to save Egress Bandwidth)
        let query = supabase
          .from('backcharges')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1500);
          
        // Apply branch filter if not national
        if (currentUser && currentUser.branch !== 'Nasional') {
          const userBranches = getUserBranches(currentUser.branch);
          if (userBranches.length > 0) {
            query = query.in('branch', userBranches);
          }
        }
          
        const { data: allBcData, error: bcError } = await query;
        if (bcError) throw bcError;
        
        const unpackedData = (allBcData || []).map(unpackExtraFields);`
  );
}

const logIndex = lines.findIndex(l => l.includes('.limit(300);'));
if (logIndex !== -1) {
    lines[logIndex] = '          .limit(100);';
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
