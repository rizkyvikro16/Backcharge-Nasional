import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { queryD1 } from '../src/cloudflareD1Client';

async function cleanAndSyncD1() {
  console.log('🚀 Syncing & cleaning all remaining /uploads/ references in Cloudflare D1...');

  const cols = [
    'file_bak_url',
    'file_handover_aso_sales_url',
    'file_handover_sales_admin_url',
    'upload_dok_pendukung'
  ];

  let totalUpdated = 0;
  let totalCleared = 0;

  for (const col of cols) {
    const rows = await queryD1(`SELECT id, ${col} FROM backcharges WHERE ${col} LIKE '/uploads/%' OR ${col} LIKE '<!DOCTYPE%'`);
    console.log(`\n📌 Column ${col}: found ${rows.length} rows.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const val = row[col];
      if (!val || typeof val !== 'string') continue;

      if (val.startsWith('<!DOCTYPE')) {
        await queryD1(`UPDATE backcharges SET ${col} = NULL WHERE id = ?`, [row.id]);
        console.log(`  🧹 Cleared HTML error string for ${row.id} [${col}]`);
        totalCleared++;
        continue;
      }

      if (val.startsWith('/uploads/')) {
        const filename = path.basename(val);
        const localPath = path.join(process.cwd(), 'uploads', filename);

        if (fs.existsSync(localPath)) {
          try {
            const ext = path.extname(localPath).toLowerCase();
            let dataUrl: string;

            if (ext === '.pdf') {
              const buf = fs.readFileSync(localPath);
              dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
            } else {
              const webpBuf = await sharp(localPath)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 75 })
                .toBuffer();
              dataUrl = `data:image/webp;base64,${webpBuf.toString('base64')}`;
            }

            await queryD1(`UPDATE backcharges SET ${col} = ? WHERE id = ?`, [dataUrl, row.id]);
            console.log(`  ✅ Embedded compressed image for ${row.id} [${col}] (${(dataUrl.length / 1024).toFixed(1)} KB)`);
            totalUpdated++;
          } catch (err: any) {
            console.error(`  ❌ Failed to compress ${filename}:`, err.message);
            await queryD1(`UPDATE backcharges SET ${col} = NULL WHERE id = ?`, [row.id]);
            totalCleared++;
          }
        } else {
          // File does not exist on disk, clear non-existent dummy placeholder
          await queryD1(`UPDATE backcharges SET ${col} = NULL WHERE id = ?`, [row.id]);
          console.log(`  🧹 Cleared non-existent file placeholder for ${row.id} [${col}] (${filename})`);
          totalCleared++;
        }
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`\n🎉 D1 CLEAN & SYNC COMPLETE! Total images embedded: ${totalUpdated}, Total non-existent cleared: ${totalCleared}`);
}

cleanAndSyncD1().catch(console.error);
