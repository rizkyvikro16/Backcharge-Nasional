const fs = require('fs');
let code = fs.readFileSync('src/components/DatabaseView.tsx', 'utf8');

code = code.replace(`              <option value="ETLE">ETLE</option>
              <option value="TPL">TPL</option>
            </select>`, `              <option value="ETLE">ETLE</option>
              <option value="TPL">TPL</option>
              <option value="Unclaimable Insurance">Unclaimable Insurance</option>
              <option value="Dokumen Kendaraan">Dokumen Kendaraan</option>
            </select>`);

fs.writeFileSync('src/components/DatabaseView.tsx', code);
