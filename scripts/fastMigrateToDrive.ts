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

async function fastMigrate() {
  console.log('🚀 Starting Fast Parallel Google Drive Migration...');

  const cols = [
    'file_bak_url',
    'file_handover_aso_sales_url',
    'file_handover_sales_admin_url',
    'upload_dok_pendukung'
  ];

  let totalMigrated = 0;

  for (const col of cols) {
    const rows = await queryD1(`SELECT id, ${col} FROM backcharges WHERE ${col} LIKE '/uploads/%'`);
    if (rows.length === 0) continue;

    console.log(`\n🔍 Found ${rows.length} records in ${col} with /uploads/`);

    // Process in parallel concurrency batches of 6
    const concurrency = 6;
    for (let i = 0; i < rows.length; i += concurrency) {
      const chunk = rows.slice(i, i + concurrency);
      await Promise.all(chunk.map(async (r) => {
        const relativePath: string = r[col];
        if (!relativePath || !relativePath.startsWith('/uploads/')) return;

        const filename = path.basename(relativePath);
        const localPath = path.join(process.cwd(), 'uploads', filename);

        const driveUrl = await uploadFileToDrive(localPath, filename);
        if (driveUrl) {
          await queryD1(`UPDATE backcharges SET ${col} = ? WHERE id = ?`, [driveUrl, r.id]);
          console.log(`  ✅ [${col}] ${r.id} -> ${driveUrl}`);
          totalMigrated++;
        } else {
          console.warn(`  ⚠️ Failed to upload ${filename} for ${r.id}`);
        }
      }));
      await new Promise(res => setTimeout(res, 200));
    }
  }

  console.log(`\n🎉 Fast Migration Complete! Total migrated files: ${totalMigrated}`);
}

fastMigrate().catch(console.error);
