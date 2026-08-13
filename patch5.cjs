const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(`                    if (t.status_payment === 'Lunas') {
                      paymentBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700">
                          Lunas
                        </span>
                      );
                    }`, `                    if (t.status_payment === 'Lunas') {
                      paymentBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          {t.payment_date ? \`Lunas (\${t.payment_date})\` : 'Lunas'}
                        </span>
                      );
                    }`);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
