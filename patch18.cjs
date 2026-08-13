const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const shBlockEnd = `        });
      }
    }`;

const insertBlock = `
    const val = t.value || 0;
    const isRegionalHead = user.role ? user.role.startsWith('Regional Head') : false;
    const isDivisionHead = user.role === 'Division Head';

    if ((isRegionalHead || user.role === 'Administrator') && val > 2000000 && val <= 15000000 && (!t.status_approval || t.status_approval === 'Belum Approval')) {
      const id = \`notif-rh-approval-\${t.id}\`;
      list.push({
        id,
        transaction_id: t.id,
        customer_name: t.customer_name,
        category: t.category,
        branch: t.branch,
        type: 'APPROVAL_RH',
        typeLabel: 'Approval Regional Head',
        description: \`Approval Backcharge: Denda \${t.category} \${t.id} (\${t.customer_name}) membutuhkan persetujuan Regional Head.\`,
        created_at: t.created_at || new Date().toISOString(),
        read: readIds.includes(id)
      });
    }

    if ((isDivisionHead || user.role === 'Administrator') && val > 15000000 && (!t.status_approval || t.status_approval === 'Belum Approval')) {
      const id = \`notif-dh-approval-\${t.id}\`;
      list.push({
        id,
        transaction_id: t.id,
        customer_name: t.customer_name,
        category: t.category,
        branch: t.branch,
        type: 'APPROVAL_DH',
        typeLabel: 'Approval Division Head',
        description: \`Approval Backcharge: Denda \${t.category} \${t.id} (\${t.customer_name}) membutuhkan persetujuan Division Head.\`,
        created_at: t.created_at || new Date().toISOString(),
        read: readIds.includes(id)
      });
    }
`;

code = code.replace(shBlockEnd, shBlockEnd + insertBlock);
fs.writeFileSync('src/App.tsx', code);
