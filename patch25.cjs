const fs = require('fs');
let code = fs.readFileSync('src/components/DetailModal.tsx', 'utf8');

const attachCode = `                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lampiran Pendukung (Maks. 3)</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {[
                                { state: approvalAttachment1, setter: setApprovalAttachment1, label: 'Lampiran 1' },
                                { state: approvalAttachment2, setter: setApprovalAttachment2, label: 'Lampiran 2' },
                                { state: approvalAttachment3, setter: setApprovalAttachment3, label: 'Lampiran 3' }
                              ].map((item, idx) => (
                                <label key={idx} className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-3 py-2 rounded-xl cursor-pointer font-bold border border-slate-200 transition-all flex-grow font-sans">
                                  <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                                  <span className="truncate max-w-[100px]">{item.state ? 'Ganti ' + item.label : item.label}</span>
                                  <input 
                                    type="file" 
                                    accept="application/pdf,image/*" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          item.setter(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                    className="hidden" 
                                  />
                                </label>
                              ))}
                            </div>
                          </div>`;

code = code.replace(
  "                            />\n                          </div>\n\n                          <button ",
  "                            />\n                          </div>\n\n" + attachCode + "\n\n                          <button "
);

fs.writeFileSync('src/components/DetailModal.tsx', code);
