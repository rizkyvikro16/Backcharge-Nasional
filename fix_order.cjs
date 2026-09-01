const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  "let idQuery = supabase.from('backcharges').select('id').range(idStart, idStart + idChunkSize - 1);",
  "let idQuery = supabase.from('backcharges').select('id').order('id').range(idStart, idStart + idChunkSize - 1);"
);

code = code.replace(
  ".gt('updated_at', lastSync)\n              .range(deltaStart, deltaStart + deltaChunkSize - 1);",
  ".gt('updated_at', lastSync)\n              .order('id')\n              .range(deltaStart, deltaStart + deltaChunkSize - 1);"
);

code = code.replace(
  ".select('id')\n            .range(start, start + chunkSize - 1);",
  ".select('id')\n            .order('id')\n            .range(start, start + chunkSize - 1);"
);

fs.writeFileSync('src/App.tsx', code);
console.log("Replaced");
