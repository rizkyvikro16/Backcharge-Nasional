import fs from 'fs';
import path from 'path';
import { queryD1 } from '../src/cloudflareD1Client';

const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwtd0ETxA17JRECbuhpPjnQRvmlI8OmExOOmbl5hlxWDY1O33rV99OZ68eVnQ7Sp_n-/exec';
const folderId = '1YDe87vD-540Tupk2gwp9qGfvGNBBoZEQ';

async function uploadFileToDrive(filePath: string, filename: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
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
    console.error('Failed upload:', filename, err.message);
  }
  return null;
}

async function migrate() {
  console.log('🚀 Starting Google Drive migration for D1 files...');

  const cols = [
    'file_bak_url',
    'file_handover_aso_sales_url',
    'file_handover_sales_admin_url',
    'upload_dok_pendukung'
  ];

  let totalMigrated = 0;

  for (const col of cols) {
    console.log(`\n🔍 Checking column: ${col}...`);
    const rows = await queryD1(`SELECT id, ${col} FROM backcharges WHERE ${col} LIKE '/uploads/%'`);
    console.log(`Found ${rows.length} records with /uploads/ in ${col}.`);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const relativePath: string = r[col];
      if (!relativePath || !relativePath.startsWith('/uploads/')) continue;

      const filename = path.basename(relativePath);
      const localPath = path.join(process.cwd(), 'uploads', filename);

      console.log(`[${i + 1}/${rows.length}] Uploading ${col} for ${r.id} (${filename})...`);
      const driveUrl = await uploadFileToDrive(localPath, filename);

      if (driveUrl) {
        await queryD1(`UPDATE backcharges SET ${col} = ? WHERE id = ?`, [driveUrl, r.id]);
        console.log(`  ✅ Successfully updated ${r.id} -> ${driveUrl}`);
        totalMigrated++;
      } else {
        console.warn(`  ⚠️ Failed to upload ${filename} for ${r.id}`);
      }

      // Small pacing delay between requests to be polite to Google Apps Script
      await new Promise(res => setTimeout(res, 300));
    }
  }

  console.log(`\n🎉 Migration Complete! Total migrated files: ${totalMigrated}`);
}

migrate().catch(console.error);
