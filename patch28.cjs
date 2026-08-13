const fs = require('fs');

let schemaSql = fs.readFileSync('schema.sql', 'utf8');

schemaSql = schemaSql.replace(
  "file_handover_sales_admin_url TEXT",
  "file_handover_sales_admin_url TEXT,\n    approval_note TEXT,\n    approval_attachment_1_url TEXT,\n    approval_attachment_2_url TEXT,\n    approval_attachment_3_url TEXT"
);

schemaSql = schemaSql.replace(
  "    status_approval TEXT, -- 'Belum Approval' | 'Disetujui' | 'Ditolak'\n", // this might not exist yet
  ""
); // I'll do this safely.

fs.writeFileSync('schema.sql', schemaSql);
