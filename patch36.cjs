const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(
  "let matchesAuthApproval = (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin') && isPendingApproval && !stepInvoice && !stepPayment;\n          if (isKacabUser && !isSuperAdmin) {\n            matchesAuthApproval = matchesAuthApproval && (t.category === 'Maintenance' || t.category === 'TPL');\n          } else if (isSalesHeadUser && !isSuperAdmin) {\n            matchesAuthApproval = matchesAuthApproval && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan');\n          }",
  "let matchesAuthApproval = (t.status_handover === 'Diserahkan ke Admin' || t.status_handover === 'Diterima Admin') && isPendingApproval && !stepInvoice && !stepPayment;\n          if (!isSuperAdmin) {\n            const val = t.value || 0;\n            const isMaintenance = t.category === 'Maintenance';\n            const isTPL = t.category === 'TPL';\n            const isRegionalHeadView = currentUser.role && currentUser.role.startsWith('Regional Head');\n            const isDivisionHeadView = currentUser.role === 'Division Head';\n            if (isKacabUser) {\n              matchesAuthApproval = matchesAuthApproval && ((isMaintenance && val <= 7500000) || (isTPL && val <= 5000000));\n            } else if (isSalesHeadUser) {\n              matchesAuthApproval = matchesAuthApproval && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE' || t.category === 'Unclaimable Insurance' || t.category === 'Dokumen Kendaraan') && val <= 5000000;\n            } else if (isRegionalHeadView) {\n              matchesAuthApproval = matchesAuthApproval && ((isMaintenance && val > 7500000 && val <= 15000000) || (!isMaintenance && val > 5000000 && val <= 15000000));\n            } else if (isDivisionHeadView) {\n              matchesAuthApproval = matchesAuthApproval && val > 15000000;\n            } else {\n              matchesAuthApproval = false;\n            }\n          }"
);

code = code.replace(
  "'Wewenang Kacab & Sales Head'}",
  "'Wewenang RH & DH & Kacab & Sales Head'}"
);

code = code.replace(
  " {isKacabUser && !isSuperAdmin && '* Pilihan ini hanya akan memproses denda kategori Maintenance & TPL.'}\n                    {isSuperAdmin && '* Role Kepala Cabang (Kacab) memproses denda Maintenance & TPL. Role Sales Head (SH) memproses denda Own Risk, Ekspedisi & ETLE.'}",
  " {isKacabUser && !isSuperAdmin && '* Pilihan ini hanya akan memproses denda kategori Maintenance (<=7.5jt) & TPL (<=5jt).'}\n                    {isSuperAdmin && '* Memproses sesuai wewenang role SH/Kacab/RH/DH dan limit nominal yang berlaku.'}"
);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
