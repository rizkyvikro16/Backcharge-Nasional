const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(
  "const isKacab = currentUser.role === 'Kepala Cabang' || (currentUser.role as string) === 'kacab';\n            const isSH = currentUser.role === 'Sales Head' || (currentUser.role as string) === 'Sales / Sales Head';\n            const isAdmin = currentUser.role === 'Administrator';",
  "const isKacab = currentUser.role === 'Kepala Cabang' || (currentUser.role as string) === 'kacab';\n            const isSH = currentUser.role === 'Sales Head' || (currentUser.role as string) === 'Sales / Sales Head';\n            const isAdmin = currentUser.role === 'Administrator';\n            const isRH = currentUser.role && currentUser.role.startsWith('Regional Head');\n            const isDH = currentUser.role === 'Division Head';\n            const val = item.value || 0;\n            const isMaintenance = item.category === 'Maintenance';\n            const isTPL = item.category === 'TPL';"
);

code = code.replace(
  "let canApproveThisItem = isAdmin;\n            if (isKacab && (item.category === 'Maintenance' || item.category === 'TPL')) canApproveThisItem = true;\n            if (isSH && (item.category === 'Own Risk' || item.category === 'Ekspedisi' || item.category === 'ETLE' || item.category === 'Unclaimable Insurance' || item.category === 'Dokumen Kendaraan')) canApproveThisItem = true;",
  "let canApproveThisItem = isAdmin;\n            if (isKacab && ((isMaintenance && val <= 7500000) || (isTPL && val <= 5000000))) canApproveThisItem = true;\n            if (isSH && (item.category === 'Own Risk' || item.category === 'Ekspedisi' || item.category === 'ETLE' || item.category === 'Unclaimable Insurance' || item.category === 'Dokumen Kendaraan') && val <= 5000000) canApproveThisItem = true;\n            if (isRH && ((isMaintenance && val > 7500000 && val <= 15000000) || (!isMaintenance && val > 5000000 && val <= 15000000))) canApproveThisItem = true;\n            if (isDH && val > 15000000) canApproveThisItem = true;"
);

code = code.replace(
  "const canUpdateApproval = currentUser.role === 'Administrator' || currentUser.role === 'Sales Head' || currentUser.role === 'Kepala Cabang' || (currentUser.role as string) === 'Sales / Sales Head' || (currentUser.role as string) === 'kacab';",
  "const canUpdateApproval = currentUser.role === 'Administrator' || currentUser.role === 'Sales Head' || currentUser.role === 'Kepala Cabang' || (currentUser.role as string) === 'Sales / Sales Head' || (currentUser.role as string) === 'kacab' || (currentUser.role as string).startsWith('Regional Head') || currentUser.role === 'Division Head';"
);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
