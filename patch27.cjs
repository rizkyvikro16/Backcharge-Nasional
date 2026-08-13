const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

const replacement = `                {transaction.approved_by && (
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Oleh: <strong className="text-slate-700">{transaction.approved_by}</strong> {transaction.approved_at ? \`pada \${transaction.approved_at}\` : ''}
                  </p>
                )}
                {transaction.approval_note && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase mb-1">Catatan Persetujuan</span>
                    <p className="text-xs text-slate-700 italic">"{transaction.approval_note}"</p>
                  </div>
                )}
                {(transaction.approval_attachment_1_url || transaction.approval_attachment_2_url || transaction.approval_attachment_3_url) && (
                  <div className="mt-2 flex gap-2">
                    {transaction.approval_attachment_1_url && (
                      <button onClick={() => window.open(transaction.approval_attachment_1_url, '_blank')} className="flex items-center space-x-1 px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded text-[9px] font-bold transition-colors">
                        <FileText className="w-3 h-3" />
                        <span>Lampiran 1</span>
                      </button>
                    )}
                    {transaction.approval_attachment_2_url && (
                      <button onClick={() => window.open(transaction.approval_attachment_2_url, '_blank')} className="flex items-center space-x-1 px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded text-[9px] font-bold transition-colors">
                        <FileText className="w-3 h-3" />
                        <span>Lampiran 2</span>
                      </button>
                    )}
                    {transaction.approval_attachment_3_url && (
                      <button onClick={() => window.open(transaction.approval_attachment_3_url, '_blank')} className="flex items-center space-x-1 px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded text-[9px] font-bold transition-colors">
                        <FileText className="w-3 h-3" />
                        <span>Lampiran 3</span>
                      </button>
                    )}
                  </div>
                )}`;

code = code.replace(
  `                {transaction.approved_by && (
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Oleh: <strong className="text-slate-700">{transaction.approved_by}</strong> {transaction.approved_at ? \`pada \${transaction.approved_at}\` : ''}
                  </p>
                )}`,
  replacement
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
