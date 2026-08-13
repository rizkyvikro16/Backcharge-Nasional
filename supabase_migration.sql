-- =========================================================================
-- PT Adi Sarana Armada, Tbk - SQL Database Migration Script for Supabase
-- =========================================================================
--
-- DESKRIPSI:
-- Script ini digunakan untuk memigrasikan data denda/backcharge yang sebelumnya 
-- dikemas (packed) di kolom 'no_bak' menggunakan pemisah '||' ke kolom-kolom
-- mandiri (individual columns) di Supabase. 
--
-- CARA PENGGUNAAN:
-- 1. Buka Dashboard Supabase Anda (https://supabase.com).
-- 2. Pilih project Anda, kemudian navigasi ke menu "SQL Editor" di panel kiri.
-- 3. Klik "+ New query" untuk membuat tab query baru.
-- 4. SALIN (Copy) seluruh isi file ini dan TEMPEL (Paste) ke editor tersebut.
-- 5. Klik tombol "Run" di kanan bawah untuk mengeksekusi script.
-- =========================================================================

-- STEP 1: TAMBAHKAN KOLOM-KOLOM BARU JIKA BELUM ADA
-- Kita pastikan semua kolom baru tipe datanya seragam dan aman (TEXT) untuk sinkronisasi
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS no_tilang TEXT DEFAULT '-';

-- Ubah tipe data kolom tanggal & tanggal_handover ke TEXT secara aman untuk mencegah "type mismatch" saat integrasi
DO $$
BEGIN
    -- Jika kolom tanggal ada dan bertipe date, ubah ke TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='backcharges' AND column_name='tanggal' AND data_type != 'text'
    ) THEN
        ALTER TABLE public.backcharges ALTER COLUMN tanggal TYPE TEXT USING tanggal::text;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='backcharges' AND column_name='tanggal'
    ) THEN
        ALTER TABLE public.backcharges ADD COLUMN tanggal TEXT;
    END IF;

    -- Jika kolom tanggal_handover ada dan bertipe date, ubah ke TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='backcharges' AND column_name='tanggal_handover' AND data_type != 'text'
    ) THEN
        ALTER TABLE public.backcharges ALTER COLUMN tanggal_handover TYPE TEXT USING tanggal_handover::text;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='backcharges' AND column_name='tanggal_handover'
    ) THEN
        ALTER TABLE public.backcharges ADD COLUMN tanggal_handover TEXT;
    END IF;
END $$;

-- Menambahkan kolom-kolom persetujuan dan informasi pelengkap lainnya
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS nama_bro TEXT DEFAULT '-';
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS alasan TEXT DEFAULT '-';
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS upload_dok_pendukung TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS status_approval TEXT DEFAULT 'Belum Approval';
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS approved_at TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS approval_attachment_1_url TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS approval_attachment_2_url TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS approval_attachment_3_url TEXT;

ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS regional_approval_status TEXT DEFAULT 'Belum Approval';
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS regional_approved_by TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS regional_approved_at TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS regional_approval_note TEXT;

ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS division_approval_status TEXT DEFAULT 'Belum Approval';
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS division_approved_by TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS division_approved_at TEXT;
ALTER TABLE public.backcharges ADD COLUMN IF NOT EXISTS division_approval_note TEXT;


-- STEP 2: JALANKAN BLOK PL/pgSQL UNTUK MEMINDAHKAN DATA DARI no_bak KE KOLOM MANDIRI
DO $$
DECLARE
    r RECORD;
    parts TEXT[];
    part TEXT;
    v_no_bak TEXT;
    
    -- Variabel penampung nilai ekstrak
    v_no_tilang TEXT;
    v_tanggal TEXT;
    v_tanggal_handover TEXT;
    v_nama_bro TEXT;
    v_alasan TEXT;
    v_upload_dok_pendukung TEXT;
    v_status_approval TEXT;
    v_approved_by TEXT;
    v_approved_at TEXT;
    v_approval_note TEXT;
    v_app_att1 TEXT;
    v_app_att2 TEXT;
    v_app_att3 TEXT;
    v_reg_status TEXT;
    v_reg_by TEXT;
    v_reg_at TEXT;
    v_reg_note TEXT;
    v_div_status TEXT;
    v_div_by TEXT;
    v_div_at TEXT;
    v_div_note TEXT;
BEGIN
    FOR r IN SELECT id, no_bak FROM public.backcharges LOOP
        -- Hanya proses jika no_bak mengandung data kemasan (ditandai pemisah '||')
        IF r.no_bak LIKE '%||%' THEN
            -- Memecah string no_bak berdasarkan '||'
            parts := string_to_array(r.no_bak, '||');
            
            -- Bagian pertama adalah nilai asli dari no_bak
            v_no_bak := parts[1];
            IF v_no_bak IS NULL OR v_no_bak = '' THEN
                v_no_bak := '-';
            END IF;
            
            -- Inisialisasi variabel penampung ke NULL
            v_no_tilang := NULL;
            v_tanggal := NULL;
            v_tanggal_handover := NULL;
            v_nama_bro := NULL;
            v_alasan := NULL;
            v_upload_dok_pendukung := NULL;
            v_status_approval := NULL;
            v_approved_by := NULL;
            v_approved_at := NULL;
            v_approval_note := NULL;
            v_app_att1 := NULL;
            v_app_att2 := NULL;
            v_app_att3 := NULL;
            v_reg_status := NULL;
            v_reg_by := NULL;
            v_reg_at := NULL;
            v_reg_note := NULL;
            v_div_status := NULL;
            v_div_by := NULL;
            v_div_at := NULL;
            v_div_note := NULL;
            
            -- Iterasi bagian-bagian setelah '||' untuk mengambil data
            FOR i IN 2..array_length(parts, 1) LOOP
                part := parts[i];
                IF part LIKE 'TILANG:%' THEN
                    v_no_tilang := substring(part from 8);
                ELSIF part LIKE 'TANGGAL:%' THEN
                    v_tanggal := substring(part from 9);
                ELSIF part LIKE 'TANGGAL_HANDOVER:%' THEN
                    v_tanggal_handover := substring(part from 18);
                ELSIF part LIKE 'NAMA_BRO:%' THEN
                    v_nama_bro := substring(part from 10);
                ELSIF part LIKE 'ALASAN:%' THEN
                    v_alasan := substring(part from 8);
                ELSIF part LIKE 'DOK_PENDUKUNG:%' THEN
                    v_upload_dok_pendukung := substring(part from 16);
                ELSIF part LIKE 'APPROVAL:%' THEN
                    v_status_approval := substring(part from 10);
                ELSIF part LIKE 'APPROVED_BY:%' THEN
                    v_approved_by := substring(part from 13);
                ELSIF part LIKE 'APPROVED_AT:%' THEN
                    v_approved_at := substring(part from 13);
                ELSIF part LIKE 'APPROVAL_NOTE:%' THEN
                    v_approval_note := substring(part from 15);
                ELSIF part LIKE 'APP_ATT1:%' THEN
                    v_app_att1 := substring(part from 10);
                ELSIF part LIKE 'APP_ATT2:%' THEN
                    v_app_att2 := substring(part from 10);
                ELSIF part LIKE 'APP_ATT3:%' THEN
                    v_app_att3 := substring(part from 10);
                ELSIF part LIKE 'REG_STATUS:%' THEN
                    v_reg_status := substring(part from 12);
                ELSIF part LIKE 'REG_BY:%' THEN
                    v_reg_by := substring(part from 7);
                ELSIF part LIKE 'REG_AT:%' THEN
                    v_reg_at := substring(part from 7);
                ELSIF part LIKE 'REG_NOTE:%' THEN
                    v_reg_note := substring(part from 9);
                ELSIF part LIKE 'DIV_STATUS:%' THEN
                    v_div_status := substring(part from 12);
                ELSIF part LIKE 'DIV_BY:%' THEN
                    v_div_by := substring(part from 7);
                ELSIF part LIKE 'DIV_AT:%' THEN
                    v_div_at := substring(part from 7);
                ELSIF part LIKE 'DIV_NOTE:%' THEN
                    v_div_note := substring(part from 9);
                END IF;
            END LOOP;
            
            -- Lakukan update ke masing-masing kolom denda dengan aman
            UPDATE public.backcharges
            SET 
                no_bak = COALESCE(v_no_bak, no_bak),
                no_tilang = COALESCE(v_no_tilang, no_tilang),
                tanggal = COALESCE(v_tanggal, tanggal),
                tanggal_handover = COALESCE(v_tanggal_handover, tanggal_handover),
                nama_bro = COALESCE(v_nama_bro, nama_bro),
                alasan = COALESCE(v_alasan, alasan),
                upload_dok_pendukung = COALESCE(v_upload_dok_pendukung, upload_dok_pendukung),
                status_approval = COALESCE(v_status_approval, status_approval),
                approved_by = COALESCE(v_approved_by, approved_by),
                approved_at = COALESCE(v_approved_at, approved_at),
                approval_note = COALESCE(v_approval_note, approval_note),
                approval_attachment_1_url = COALESCE(v_app_att1, approval_attachment_1_url),
                approval_attachment_2_url = COALESCE(v_app_att2, approval_attachment_2_url),
                approval_attachment_3_url = COALESCE(v_app_att3, approval_attachment_3_url),
                regional_approval_status = COALESCE(v_reg_status, regional_approval_status),
                regional_approved_by = COALESCE(v_reg_by, regional_approved_by),
                regional_approved_at = COALESCE(v_reg_at, regional_approved_at),
                regional_approval_note = COALESCE(v_reg_note, regional_approval_note),
                division_approval_status = COALESCE(v_div_status, division_approval_status),
                division_approved_by = COALESCE(v_div_by, division_approved_by),
                division_approved_at = COALESCE(v_div_at, division_approved_at),
                division_approval_note = COALESCE(v_div_note, division_approval_note)
            WHERE id = r.id;
        END IF;
    END LOOP;
END $$;

-- Menampilkan pesan sukses migrasi
SELECT 'Migrasi berhasil diselesaikan dengan aman!' AS hasil_migrasi;
