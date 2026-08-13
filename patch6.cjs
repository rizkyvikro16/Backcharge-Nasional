const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(`                {((isKacabRole && (transaction.category === 'Maintenance' || transaction.category === 'TPL')) ||
                  (isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE')) ||
                  currentUser.role === 'Administrator') && (
                  <div className={\`p-4 rounded-xl border transition-all \${`, `                {(isAuthorizedApprover || currentUser.role === 'Administrator') && (
                  <div className={\`p-4 rounded-xl border transition-all \${`);

code = code.replace(`                            Wewenang: {transaction.category === 'Maintenance' || transaction.category === 'TPL' ? 'Kepala Cabang (Kacab)' : 'Sales Head (SH)'}
                          </span>`, `                            Wewenang: {expectedApproverLabel}
                          </span>`);

code = code.replace(`                            <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-extrabold uppercase">
                              {transaction.category === 'Maintenance' || transaction.category === 'TPL' ? 'Wewenang Kacab' : 'Wewenang Sales Head'}
                            </span>`, `                            <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-extrabold uppercase">
                              Wewenang {expectedApproverLabel}
                            </span>`);

code = code.replace(`                        {((isKacabRole && (transaction.category === 'Maintenance' || transaction.category === 'TPL')) ||
                          (isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE'))) && (
                          <button `, `                        {(isAuthorizedApprover || currentUser.role === 'Administrator') && (
                          <button `);

code = code.replace(`                {!(isSales || isBro || isAdminView) && 
                 !((isKacabRole && (transaction.category === 'Maintenance' || transaction.category === 'TPL')) ||
                   (isSalesHeadRole && (transaction.category === 'Own Risk' || transaction.category === 'Ekspedisi' || transaction.category === 'ETLE')) ||
                   currentUser.role === 'Administrator') && 
                 !isAdminView && (`, `                {!(isSales || isBro || isAdminView || isAuthorizedApprover) && (`);

fs.writeFileSync('src/components/DetailModal.tsx', code);
