const fs = require('fs');

let setupSql = fs.readFileSync('supabase_setup.sql', 'utf8');

setupSql = setupSql.replace(
  "file_handover_sales_admin_url text",
  "file_handover_sales_admin_url text,\n    status_approval text,\n    approved_by text,\n    approved_at text,\n    approval_note text,\n    approval_attachment_1_url text,\n    approval_attachment_2_url text,\n    approval_attachment_3_url text"
);

fs.writeFileSync('supabase_setup.sql', setupSql);
