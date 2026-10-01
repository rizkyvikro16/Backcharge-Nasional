import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { queryD1 } from '../src/cloudflareD1Client';

async function compressImageToDataUrl(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      // PDF files shouldn't be compressed as images
      const buffer = fs.readFileSync(filePath);
      return `data:application/pdf;base64,${buffer.toString('base64')}`;
    }

    const buffer = await sharp(filePath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    return `data:image/webp;base64,${buffer.toString('base64')}`;
  } catch (err: any) {
    console.error('Failed to compress:', filePath, err.message);
    return null;
  }
}

async function compressAll() {
  console.log('🚀 Starting D1 Image Compression & Embed Script...');

  const columns = [
    'file_bak_url',
    'file_handover_aso_sales_url',
    'file_handover_sales_admin_url',
    'upload_dok_pendukung'
  ];

  let totalCompressed = 0;

  for (const col of columns) {
    const rows = await queryD1(`SELECT id, ${col} FROM backcharges WHERE ${col} LIKE '/uploads/%'`);
    console.log(`\n📌 Column ${col}: found ${rows.length} rows to compress.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const val = row[col];
      if (!val || typeof val !== 'string' || !val.startsWith('/uploads/')) continue;

      const filename = path.basename(val);
      const localPath = path.join(process.cwd(), 'uploads', filename);

      const compressedDataUrl = await compressImageToDataUrl(localPath);

      if (compressedDataUrl) {
        await queryD1(`UPDATE backcharges SET ${col} = ? WHERE id = ?`, [compressedDataUrl, row.id]);
        console.log(`  ✅ [${col}] ${row.id} (${(compressedDataUrl.length / 1024).toFixed(1)} KB base64)`);
        totalCompressed++;
      } else {
        console.warn(`  ⚠️ Could not compress ${filename} for ${row.id}`);
      }

      await new Promise(res => setTimeout(res, 100));
    }
  }

  console.log(`\n🎉 COMPRESSION COMPLETE! Total converted images: ${totalCompressed}`);
}

compressAll().catch(console.error);
