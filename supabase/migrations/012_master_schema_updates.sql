-- 012_master_schema_updates.sql

-- Add address3, cellno1, cellno2, and Bank Account details to ledger table
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS add3 VARCHAR(200);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS cell_no1 VARCHAR(50);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS cell_no2 VARCHAR(50);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bank_acc_no VARCHAR(100);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bank_acc_name VARCHAR(150);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(50);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100);

-- Add barcode_gen_type, hsn_code, gst_perc to product table
ALTER TABLE product ADD COLUMN IF NOT EXISTS barcode_gen_type VARCHAR(50) DEFAULT 'Manual';
ALTER TABLE product ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
ALTER TABLE product ADD COLUMN IF NOT EXISTS gst_perc NUMERIC(18,2) DEFAULT 0;
