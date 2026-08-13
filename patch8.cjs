const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(`              {/* No. SPK */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. SPK (Surat Perintah Kerja)</label>
                <input `, `              {/* No. SPK */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{editCategory === 'TPL' ? 'No. Dokumen' : 'No. SPK (Surat Perintah Kerja)'}</label>
                <input `);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
