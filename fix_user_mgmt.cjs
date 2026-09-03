const fs = require('fs');

let content = fs.readFileSync('src/components/UserManagement.tsx', 'utf8');

// Change role state
content = content.replace("const [role, setRole] = useState<UserRole>('ASO');", "const [role, setRole] = useState<string>('ASO');");

// Change handleRoleChange param
content = content.replace("const handleRoleChange = (newRole: UserRole) => {", "const handleRoleChange = (newRole: string) => {");

// Cast role onAddUser
content = content.replace("role, branch, password.trim() || undefined", "role as UserRole, branch, password.trim() || undefined");

// Cast role onUpdateUser
content = content.replace("role: role,", "role: role as UserRole,");

// Update UI
const uiOld = `<select 
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ASO">ASO</option>
                      <option value="Maintenance Center">Maintenance Center</option>
                      <option value="ASO Megabranch">ASO Megabranch</option>
                      <option value="Sales Head">Sales Head</option>
                      <option value="BRO">BRO</option>
                      <option value="Admin">Admin</option>
                      <option value="Admin Head">Admin Head</option>
                      <option value="Administrator">Administrator</option>
                      <option value="Kepala Cabang">Kepala Cabang</option>
                      <option value="Division Head">Division Head</option>
                      <option value="Regional Head West">Regional Head West</option>
                      <option value="Regional Head Central">Regional Head Central</option>
                      <option value="Regional Head East">Regional Head East</option>
                      <option value="Regional Head">Regional Head (General)</option>
                    </select>`;

const uiNew = `
                    <select 
                      value={role.split(',')[0].trim()}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ASO">ASO</option>
                      <option value="Maintenance Center">Maintenance Center</option>
                      <option value="ASO Megabranch">ASO Megabranch</option>
                      <option value="Sales Head">Sales Head</option>
                      <option value="BRO">BRO</option>
                      <option value="Admin">Admin</option>
                      <option value="Admin Head">Admin Head</option>
                      <option value="Administrator">Administrator</option>
                      <option value="Kepala Cabang">Kepala Cabang</option>
                      <option value="Division Head">Division Head</option>
                      <option value="Regional Head West">Regional Head West</option>
                      <option value="Regional Head Central">Regional Head Central</option>
                      <option value="Regional Head East">Regional Head East</option>
                      <option value="Regional Head">Regional Head (General)</option>
                    </select>

                    {/* Secondary Role Checkboxes for Regional/Division Head */}
                    {['Division Head', 'Regional Head', 'Regional Head West', 'Regional Head Central', 'Regional Head East'].includes(role.split(',')[0].trim()) && (
                      <div className="mt-3 p-3 border border-blue-200 bg-blue-50/50 rounded-xl shadow-2xs">
                        <label className="block text-[10px] font-bold text-blue-700 uppercase mb-2 tracking-wider">
                          Pilih Role Tambahan (Khusus Regional/Division Head)
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {['Division Head', 'Regional Head West', 'Regional Head Central', 'Regional Head East', 'Regional Head']
                            .filter(r => r !== role.split(',')[0].trim())
                            .map(r => {
                              const selectedRoles = role.split(',').map(s => s.trim());
                              const isChecked = selectedRoles.includes(r);
                              return (
                                <label key={r} className="flex items-center gap-2 cursor-pointer group">
                                  <div className={\`w-4 h-4 rounded flex items-center justify-center transition-colors \${isChecked ? 'bg-blue-600 border-blue-600' : 'border-2 border-slate-300 group-hover:border-blue-400 bg-white'}\`}>
                                    {isChecked && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setRole([...selectedRoles, r].join(', '));
                                      } else {
                                        setRole(selectedRoles.filter(sr => sr !== r).join(', '));
                                      }
                                    }} 
                                  />
                                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">{r}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
`;
content = content.replace(uiOld, uiNew);

fs.writeFileSync('src/components/UserManagement.tsx', content);
