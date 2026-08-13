const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(`      // Stage 4: Approval Sales Head / Kacab sesuai otorisasi
      const role = currentUser?.role as string;
      const isKacabRole = role === 'Kepala Cabang' || role === 'kacab';
      const isSalesHeadRole = role === 'Sales Head' || role === 'Sales / Sales Head';
      const isSuperAdmin = role === 'Administrator';

      let matchesAuth = true;
      if (isKacabRole && !isSuperAdmin) {
        matchesAuth = (t.category === 'Maintenance' || t.category === 'TPL');
      } else if (isSalesHeadRole && !isSuperAdmin) {
        matchesAuth = (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE');
      }`, `      // Stage 4: Approval by authorized roles
      const role = currentUser?.role as string;
      const isKacabRole = role === 'Kepala Cabang' || role === 'kacab';
      const isSalesHeadRole = role === 'Sales Head' || role === 'Sales / Sales Head';
      const isSuperAdmin = role === 'Administrator';
      const isRegionalHead = role ? role.startsWith('Regional Head') : false;
      const isDivisionHead = role === 'Division Head';
      const val = t.value || 0;

      let matchesAuth = false;
      if (isSuperAdmin) {
        matchesAuth = true;
      } else {
        const isKacabApprover = isKacabRole && (t.category === 'Maintenance' || t.category === 'TPL') && val <= 2000000;
        const isSalesHeadApprover = isSalesHeadRole && (t.category === 'Own Risk' || t.category === 'Ekspedisi' || t.category === 'ETLE') && val <= 2000000;
        const isRegionalHeadApprover = isRegionalHead && val > 2000000 && val <= 15000000;
        const isDivisionHeadApprover = isDivisionHead && val > 15000000;
        
        matchesAuth = isKacabApprover || isSalesHeadApprover || isRegionalHeadApprover || isDivisionHeadApprover;
      }`);

fs.writeFileSync('src/components/Dashboard.tsx', code);
