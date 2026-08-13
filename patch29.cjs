const fs = require('fs');

let schemaSql = fs.readFileSync('schema.sql', 'utf8');

schemaSql = schemaSql.replace(
  "    status_payment TEXT NOT NULL DEFAULT 'Belum Bayar', -- E.g. Belum Bayar, Lunas\n",
  "    status_payment TEXT NOT NULL DEFAULT 'Belum Bayar', -- E.g. Belum Bayar, Lunas\n    status_approval TEXT,\n    approved_by TEXT,\n    approved_at TEXT,\n"
);

fs.writeFileSync('schema.sql', schemaSql);
