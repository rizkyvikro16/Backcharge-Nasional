const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetIdFetch = `          // b. Fetch only IDs to prune deleted rows (Extremely lightweight, ~150KB for 5000 rows)
          let idQuery = supabase.from('backcharges').select('id');
          if (currentUser && currentUser.branch !== 'Nasional') {
            const userBranches = getUserBranches(currentUser.branch);
            if (userBranches.length > 0) idQuery = idQuery.in('branch', userBranches);
          }
          const { data: dbIdsData, error: idError } = await idQuery;
          if (idError) throw idError;
          
          const validIds = new Set((dbIdsData || []).map(d => d.id));`;

const replacementIdFetch = `          // b. Fetch only IDs to prune deleted rows (Paginated to handle >1000 rows limit)
          let allDbIds: string[] = [];
          let idStart = 0;
          let idChunkSize = 1000;
          let hasMoreIds = true;
          
          while (hasMoreIds) {
            let idQuery = supabase.from('backcharges').select('id').range(idStart, idStart + idChunkSize - 1);
            if (currentUser && currentUser.branch !== 'Nasional') {
              const userBranches = getUserBranches(currentUser.branch);
              if (userBranches.length > 0) idQuery = idQuery.in('branch', userBranches);
            }
            const { data: dbIdsData, error: idError } = await idQuery;
            if (idError) throw idError;
            
            if (dbIdsData && dbIdsData.length > 0) {
              allDbIds = [...allDbIds, ...dbIdsData.map(d => d.id)];
              if (dbIdsData.length < idChunkSize) hasMoreIds = false;
              else idStart += idChunkSize;
            } else {
              hasMoreIds = false;
            }
          }
          const validIds = new Set(allDbIds);`;

code = code.replace(targetIdFetch, replacementIdFetch);


const targetDeltaFetch = `          // d. Fetch ONLY newly created or updated records since last sync
          let deltaQuery = supabase
            .from('backcharges')
            .select('*')
            .gt('updated_at', lastSync);
            
          if (currentUser && currentUser.branch !== 'Nasional') {
            const userBranches = getUserBranches(currentUser.branch);
            if (userBranches.length > 0) deltaQuery = deltaQuery.in('branch', userBranches);
          }
          const { data: deltaData, error: deltaError } = await deltaQuery;
          if (deltaError) throw deltaError;`;

const replacementDeltaFetch = `          // d. Fetch ONLY newly created or updated records since last sync (Paginated)
          let deltaData: any[] = [];
          let deltaStart = 0;
          let deltaChunkSize = 1000;
          let hasMoreDelta = true;
          
          while (hasMoreDelta) {
            let deltaQuery = supabase
              .from('backcharges')
              .select('*')
              .gt('updated_at', lastSync)
              .range(deltaStart, deltaStart + deltaChunkSize - 1);
              
            if (currentUser && currentUser.branch !== 'Nasional') {
              const userBranches = getUserBranches(currentUser.branch);
              if (userBranches.length > 0) deltaQuery = deltaQuery.in('branch', userBranches);
            }
            
            const { data: chunkData, error: deltaError } = await deltaQuery;
            if (deltaError) throw deltaError;
            
            if (chunkData && chunkData.length > 0) {
              deltaData = [...deltaData, ...chunkData];
              if (chunkData.length < deltaChunkSize) hasMoreDelta = false;
              else deltaStart += deltaChunkSize;
            } else {
              hasMoreDelta = false;
            }
          }`;

code = code.replace(targetDeltaFetch, replacementDeltaFetch);

// Let's also check the batch import insert code. It's 500 rows per batch, which should be okay.
// However, I'll lower it to 100 just to be super safe against Postgres query payload sizes.
code = code.replace('const batchSize = 500;', 'const batchSize = 100;');

fs.writeFileSync('src/App.tsx', code);
