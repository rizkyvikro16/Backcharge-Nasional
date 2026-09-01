const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `        // 1. Fetch ALL backcharges (Paginated) for 100% Dashboard Sync
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
        
        const unpackedData = allBcData.map(unpackExtraFields);
        setTransactions(unpackedData as Backcharge[]);
        try { localStorage.setItem('backcharge_cache_txs', JSON.stringify(unpackedData)); } catch {}`;

const replacement = `        // 1. SMART DELTA SYNC (To prevent Egress quota blow up with 5000+ data)
        let cachedTxs: any[] = [];
        try {
          const cacheStr = localStorage.getItem('backcharge_cache_txs');
          if (cacheStr) cachedTxs = JSON.parse(cacheStr);
        } catch (e) {}

        let unpackedData: Backcharge[] = [];

        if (cachedTxs.length > 0) {
          // If we have cache, we do a lightweight sync to save >90% Egress
          // a. Get the latest updated_at from cache
          let lastSync = new Date(0).toISOString();
          for (const tx of cachedTxs) {
            if (tx.updated_at && tx.updated_at > lastSync) {
              lastSync = tx.updated_at;
            }
          }

          // b. Fetch only IDs to prune deleted rows (Extremely lightweight, ~150KB for 5000 rows)
          let idQuery = supabase.from('backcharges').select('id');
          if (currentUser && currentUser.branch !== 'Nasional') {
            const userBranches = getUserBranches(currentUser.branch);
            if (userBranches.length > 0) idQuery = idQuery.in('branch', userBranches);
          }
          const { data: dbIdsData, error: idError } = await idQuery;
          if (idError) throw idError;
          
          const validIds = new Set((dbIdsData || []).map(d => d.id));
          
          // c. Filter out deleted records from cache
          let syncedTxs = cachedTxs.filter(tx => validIds.has(tx.id));

          // d. Fetch ONLY newly created or updated records since last sync
          let deltaQuery = supabase
            .from('backcharges')
            .select('*')
            .gt('updated_at', lastSync);
            
          if (currentUser && currentUser.branch !== 'Nasional') {
            const userBranches = getUserBranches(currentUser.branch);
            if (userBranches.length > 0) deltaQuery = deltaQuery.in('branch', userBranches);
          }
          const { data: deltaData, error: deltaError } = await deltaQuery;
          if (deltaError) throw deltaError;

          // e. Merge the delta into our synced list
          if (deltaData && deltaData.length > 0) {
            const deltaUnpacked = deltaData.map(unpackExtraFields);
            const deltaMap = new Map(deltaUnpacked.map((tx: any) => [tx.id, tx]));
            
            // Replace updated records
            syncedTxs = syncedTxs.map(tx => deltaMap.has(tx.id) ? deltaMap.get(tx.id) : tx);
            
            // Add brand new records
            const existingIds = new Set(syncedTxs.map(tx => tx.id));
            const newTxs = deltaUnpacked.filter((tx: any) => !existingIds.has(tx.id));
            syncedTxs = [...newTxs, ...syncedTxs];
          }
          
          // Sort final list by created_at descending
          syncedTxs.sort((a, b) => new Date(b.created_at || b.tanggal).getTime() - new Date(a.created_at || a.tanggal).getTime());
          unpackedData = syncedTxs as Backcharge[];

        } else {
          // If no cache (first time load on this device), do a full paginated fetch
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
              if (chunkData.length < chunkSize) hasMore = false;
              else start += chunkSize;
            } else {
              hasMore = false;
            }
          }
          unpackedData = allBcData.map(unpackExtraFields) as Backcharge[];
        }

        setTransactions(unpackedData);
        try { localStorage.setItem('backcharge_cache_txs', JSON.stringify(unpackedData)); } catch {}`;

if (code.includes('// 1. Fetch ALL backcharges (Paginated) for 100% Dashboard Sync')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log('Update successful');
} else {
    console.log('Target not found');
}
