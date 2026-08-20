-- 014_barcode_setting_updates.sql

-- Create table for Barcode Setting Master
CREATE TABLE IF NOT EXISTS barcode_setting (
    ref_no SERIAL PRIMARY KEY,
    bar_name VARCHAR(100) NOT NULL,
    is_inactive BOOLEAN DEFAULT false,
    app_from TIMESTAMPTZ DEFAULT NOW(),
    prefix VARCHAR(20) DEFAULT 'KS',
    suffix VARCHAR(20) DEFAULT '',
    seed_len INTEGER DEFAULT 5,
    seed INTEGER DEFAULT 2304,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE barcode_setting ENABLE ROW LEVEL SECURITY;

-- Insert default Barcode Setting rule
INSERT INTO barcode_setting (bar_name, is_inactive, prefix, suffix, seed_len, seed)
VALUES ('[Default]', false, 'KS', '', 5, 2304),
       ('2StickerFixedPrice', false, 'KS', '', 5, 2304)
ON CONFLICT DO NOTHING;

-- Extend bar_temp with metadata for Barcode Printing screen
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS inv_no VARCHAR(50);
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS inv_date TIMESTAMPTZ;
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS entry_sno INTEGER;
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS cost_rate NUMERIC(18,2) DEFAULT 0;
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS markup NUMERIC(18,2) DEFAULT 0;
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS margin NUMERIC(18,2) DEFAULT 0;
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS print_count INTEGER DEFAULT 1;
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS grp_name VARCHAR(100);
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE bar_temp ADD COLUMN IF NOT EXISTS unit_name VARCHAR(50);
