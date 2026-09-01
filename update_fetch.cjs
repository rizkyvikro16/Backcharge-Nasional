const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `        // 1. Fetch backcharges (Limit to 1500 terbaru to save Egress Bandwidth)
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
        
        const unpackedData = (allBcData || []).map(unpackExtraFields);`;

const replacement = `        // 1. Fetch ALL backcharges (Paginated) for 100% Dashboard Sync
        // (Since Base64 is cleared, this is very lightweight and safe for egress)
        let allBcData: any[] = [];
        let start = 0;
        const chunkSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          let query = supabase
            .from('backcharges')
            .select('*')
            .order('created_at', { ascending: false })
            .range(start, start + chunkSize - 1);
            
          if (currentUser && currentUser.branch !== 'Nasional') {
            const userBranches = getUserBranches(currentUser.branch);
            if (userBranches.length > 0) {
              query = query.in('branch', userBranches);
            }
          }
          
          const { data: chunkData, error: bcError } = await query;
          if (bcError) throw bcError;
          
          if (chunkData && chunkData.length > 0) {
            allBcData = [...allBcData, ...chunkData];
            if (chunkData.length < chunkSize) {
              hasMore = false;
            } else {
              start += chunkSize;
            }
          } else {
            hasMore = false;
          }
        }
        
        const unpackedData = allBcData.map(unpackExtraFields);`;

if (code.includes('// 1. Fetch backcharges (Limit to 1500 terbaru to save Egress Bandwidth)')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log('Update successful');
} else {
    console.log('Target not found');
}
