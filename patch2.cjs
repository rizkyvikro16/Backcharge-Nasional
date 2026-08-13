const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

code = code.replace(`                          {transaction.no_invoice && transaction.no_invoice !== '-' && transaction.status_payment === 'Belum Bayar' && isAdmin && (
                            <button 
                              onClick={handleSetPaid}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer"
                            >
                              💰 Set Status Lunas
                            </button>
                          )}
                        </div>
                      </div>
                    )}`, `                          {transaction.no_invoice && transaction.no_invoice !== '-' && transaction.status_payment === 'Belum Bayar' && isAdmin && (
                            <button 
                              onClick={() => setShowActionForm('paid')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow transition-all cursor-pointer"
                            >
                              💰 Set Status Lunas
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {showActionForm === 'paid' && (
                      <div className="space-y-3 border-t border-emerald-200/80 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">Form Konfirmasi Pelunasan</span>
                          <button onClick={() => setShowActionForm(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">Batal</button>
                        </div>
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block text-slate-600 font-semibold mb-1">Tanggal Bayar Customer <span className="text-rose-500">*</span></label>
                            <input 
                              type="date"
                              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={modalPaymentDate}
                              onChange={(e) => setModalPaymentDate(e.target.value)}
                            />
                          </div>
                          <button 
                            onClick={handleSetPaid}
                            disabled={actionLoading || !modalPaymentDate}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow"
                          >
                            Konfirmasi Lunas
                          </button>
                        </div>
                      </div>
                    )}`);

fs.writeFileSync('src/components/DetailModal.tsx', code);
