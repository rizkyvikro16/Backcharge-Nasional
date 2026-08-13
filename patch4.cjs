const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(`                          {transaction.status_payment === 'Lunas' ? 'Lunas' : 'Belum Bayar'}
                        </span>
                      </div>
                    </div>`, `                          {transaction.status_payment === 'Lunas' ? (transaction.payment_date ? \`Lunas (\${transaction.payment_date})\` : 'Lunas') : 'Belum Bayar'}
                        </span>
                      </div>
                    </div>`);

fs.writeFileSync('src/components/DetailModal.tsx', code);
