-- =========================================================================
-- SISTEM WORKFLOW BACKCHARGE NASIONAL - SUPABASE DATABASE SCHEMA
-- =========================================================================

-- 1. Create Profile / User Table
-- This table links with Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Administrator', 'ASO / Staff', 'Sales / Sales Head', 'BRO', 'Admin')),
    branch TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for authenticated profiles" 
    ON public.profiles FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow profile owner or admin to update profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator'
    ));

CREATE POLICY "Allow admin to insert profiles" 
    ON public.profiles FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator'
    ));

CREATE POLICY "Allow admin to delete profiles" 
    ON public.profiles FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator'
    ));


-- 2. Create Backcharge Transactions Table
CREATE TABLE IF NOT EXISTS public.backcharges (
    id TEXT PRIMARY KEY, -- E.g. BC-2026-0001
    category TEXT NOT NULL CHECK (category IN ('Own Risk', 'Maintenance', 'Ekspedisi', 'ETLE', 'TPL')),
    branch TEXT NOT NULL,
    no_bak TEXT DEFAULT '-',
    no_spk TEXT DEFAULT '-',
    no_sap TEXT DEFAULT '-',
    customer_name TEXT NOT NULL,
    license_plate TEXT DEFAULT '-',
    value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status_sap TEXT NOT NULL DEFAULT 'N/A', -- E.g. N/A, Bill, Not Bill
    status_confirm TEXT NOT NULL DEFAULT 'Belum Konfirmasi', -- E.g. Belum Konfirmasi, Telah Dikonfirmasi, Ditolak / Negosiasi Ulang
    status_handover TEXT NOT NULL DEFAULT 'Pending', -- E.g. Pending, Diserahkan ke Admin, Diterima Admin
    no_invoice TEXT DEFAULT '-',
    status_payment TEXT NOT NULL DEFAULT 'Belum Bayar', -- E.g. Belum Bayar, Lunas
    created_by TEXT NOT NULL, -- Email of creator
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- File & Photo Upload Columns (Storage URLs or Object Paths)
    file_bak_url TEXT,
    file_handover_aso_sales_url TEXT,
    file_handover_sales_admin_url TEXT
);

-- Enable RLS for Backcharges
ALTER TABLE public.backcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow selection based on branch or national access" 
    ON public.backcharges FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND (profiles.branch = 'Nasional' OR profiles.branch = backcharges.branch)
        )
    );

CREATE POLICY "Allow inserts for ASO / Staff and Admins" 
    ON public.backcharges FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND (profiles.role IN ('ASO / Staff', 'Administrator'))
        )
    );

CREATE POLICY "Allow updates for appropriate roles" 
    ON public.backcharges FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND (
                profiles.role = 'Administrator' OR 
                profiles.branch = 'Nasional' OR 
                profiles.branch = backcharges.branch
            )
        )
    );


-- 3. Create Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    transaction_id TEXT NOT NULL,
    performed_by TEXT NOT NULL, -- Email or Name
    action_description TEXT NOT NULL
);

-- Enable RLS for Activity Logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read for logs" 
    ON public.activity_logs FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow system insertions for logs" 
    ON public.activity_logs FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');


-- =========================================================================
-- 4. AUTOMATIC DOCUMENT STATUS LOGGING TRIGGER
-- This automatically logs status changes inside the 'backcharges' table.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_log_backcharge_status_changes()
RETURNS TRIGGER AS $$
DECLARE
    log_desc TEXT := '';
BEGIN
    -- Detect INSERT
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (transaction_id, performed_by, action_description)
        VALUES (
            NEW.id, 
            NEW.created_by, 
            'Membuat transaksi Backcharge baru kategori ' || NEW.category || ' di cabang ' || NEW.branch
        );
        RETURN NEW;
    END IF;

    -- Detect UPDATE and track status modifications
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status_confirm <> NEW.status_confirm) THEN
            log_desc := log_desc || 'Status Konfirmasi berubah dari "' || OLD.status_confirm || '" menjadi "' || NEW.status_confirm || '". ';
        END IF;
        
        IF (OLD.status_sap <> NEW.status_sap) THEN
            log_desc := log_desc || 'Status SAP berubah dari "' || OLD.status_sap || '" menjadi "' || NEW.status_sap || '". ';
        END IF;

        IF (OLD.status_handover <> NEW.status_handover) THEN
            log_desc := log_desc || 'Status Serah Terima berubah dari "' || OLD.status_handover || '" menjadi "' || NEW.status_handover || '". ';
        END IF;

        IF (OLD.no_invoice <> NEW.no_invoice) THEN
            log_desc := log_desc || 'Nomor Invoice diperbarui dari "' || OLD.no_invoice || '" menjadi "' || NEW.no_invoice || '". ';
        END IF;

        IF (OLD.status_payment <> NEW.status_payment) THEN
            log_desc := log_desc || 'Status Pembayaran berubah dari "' || OLD.status_payment || '" menjadi "' || NEW.status_payment || '". ';
        END IF;
        
        -- Logging file upload attachments
        IF (OLD.file_bak_url IS NULL AND NEW.file_bak_url IS NOT NULL) THEN
            log_desc := log_desc || 'File BAK berhasil diupload. ';
        END IF;
        IF (OLD.file_handover_aso_sales_url IS NULL AND NEW.file_handover_aso_sales_url IS NOT NULL) THEN
            log_desc := log_desc || 'Foto serah terima ASO ke Sales diupload. ';
        END IF;
        IF (OLD.file_handover_sales_admin_url IS NULL AND NEW.file_handover_sales_admin_url IS NOT NULL) THEN
            log_desc := log_desc || 'Foto serah terima Sales ke Admin diupload. ';
        END IF;

        -- If any of the tracked fields changed, write to logs
        IF (log_desc <> '') THEN
            -- Update the updated_at timestamp on the backcharge record
            NEW.updated_at := timezone('utc'::text, now());
            
            INSERT INTO public.activity_logs (transaction_id, performed_by, action_description)
            VALUES (NEW.id, NEW.created_by, log_desc);
        END IF;
        
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the Trigger
CREATE OR REPLACE TRIGGER tr_backcharge_status_logger
    AFTER INSERT OR UPDATE ON public.backcharges
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_log_backcharge_status_changes();
