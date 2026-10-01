import fs from 'fs';
import path from 'path';
import { queryD1 } from '../src/cloudflareD1Client';

const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwtd0ETxA17JRECbuhpPjnQRvmlI8OmExOOmbl5hlxWDY1O33rV99OZ68eVnQ7Sp_n-/exec';
const folderId = '1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ';

async function uploadToDrive(localPath: string, filename: string): Promise<string | null> {
  if (!fs.existsSync(localPath)) return null;
  const buffer = fs.readFileSync(localPath);
  const base64Data = buffer.toString('base64');

  const ext = path.extname(filename).toLowerCase().replace('.', '') || 'jpg';
  let mimeType = 'image/jpeg';
  if (ext === 'png') mimeType = 'image/png';
  else if (ext === 'webp') mimeType = 'image/webp';
  else if (ext === 'pdf') mimeType = 'application/pdf';

  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        fileBase64: base64Data,
        fileName: filename,
        mimeType: mimeType,
        folderId: folderId,
        parentId: folderId
      }),
      redirect: 'follow'
    });

    if (res.ok) {
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { fileUrl: text };
      }
      const url = data?.fileUrl || data?.url || (data?.fileId ? `https://drive.google.com/file/d/${data.fileId}/view` : null);
      return url;
    }
  } catch (err: any) {
    console.error('Failed to upload', filename, err.message);
  }
  return null;
}

async function run() {
  console.log('🚀 Running full migration of local /uploads/ files to Google Drive...');

  const columns = [
    'file_bak_url',
    'file_handover_aso_sales_url',
    'file_handover_sales_admin_url',
    'upload_dok_pendukung'
  ];

  for (const col of columns) {
    const rows = await queryD1(`SELECT id, ${col} FROM backcharges WHERE ${col} LIKE '/uploads/%'`);
    console.log(`\n📌 Column ${col}: found ${rows.length} rows to migrate.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const val = row[col];
      if (!val || typeof val !== 'string' || !val.startsWith('/uploads/')) continue;

      const filename = path.basename(val);
      const localPath = path.join(process.cwd(), 'uploads', filename);

      console.log(`[${i + 1}/${rows.length}] Migrating ${row.id} (${filename})...`);
      const driveUrl = await uploadToDrive(localPath, filename);

      if (driveUrl) {
        await queryD1(`UPDATE backcharges SET ${col} = ? WHERE id = ?`, [driveUrl, row.id]);
        console.log(`  ✅ Updated ${row.id} [${col}] -> ${driveUrl}`);
      } else {
        console.warn(`  ⚠️ Failed to upload ${filename} for ${row.id}`);
      }

      await new Promise(r => setTimeout(r, 250));
    }
  }

  console.log('\n✨ ALL MIGRATIONS COMPLETE!');
}

run().catch(console.error);
