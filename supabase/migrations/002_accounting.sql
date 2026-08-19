-- 002_accounting.sql

CREATE TABLE IF NOT EXISTS group_master (
    grp_id SERIAL PRIMARY KEY,
    grp_name VARCHAR(100) NOT NULL,
    grp_type VARCHAR(50) DEFAULT 'Primary' CHECK (grp_type IN ('Primary', 'SubGroup')),
    base_grp_id INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE group_master ENABLE ROW LEVEL SECURITY;

INSERT INTO group_master (grp_id, grp_name, grp_type, base_grp_id) VALUES
(1, 'Capital Account', 'Primary', 0),
(2, 'Loans (Liability)', 'Primary', 0),
(3, 'Current Liabilities', 'Primary', 0),
(4, 'Fixed Assets', 'Primary', 0),
(5, 'Investments', 'Primary', 0),
(6, 'Current Assets', 'Primary', 0),
(7, 'Branch/Divisions', 'Primary', 0),
(8, 'Misc. Expenses (ASSET)', 'Primary', 0),
(9, 'Suspense A/c', 'Primary', 0),
(10, 'Sales Accounts', 'Primary', 0),
(11, 'Purchase Accounts', 'Primary', 0),
(12, 'Direct Incomes', 'Primary', 0),
(13, 'Direct Expenses', 'Primary', 0),
(14, 'Indirect Incomes', 'Primary', 0),
(15, 'Indirect Expenses', 'Primary', 0),
(59, 'Sundry Debtors', 'SubGroup', 6),
(60, 'Bank Accounts', 'SubGroup', 6),
(61, 'Cash-in-Hand', 'SubGroup', 6),
(62, 'Deposits (Asset)', 'SubGroup', 6),
(63, 'Stock-in-Hand', 'SubGroup', 6),
(64, 'Duties & Taxes', 'SubGroup', 3),
(65, 'Sundry Creditors', 'SubGroup', 3),
(66, 'Provisions', 'SubGroup', 3),
(67, 'Secured Loans', 'SubGroup', 2),
(68, 'Unsecured Loans', 'SubGroup', 2),
(69, 'Reserves & Surplus', 'SubGroup', 1),
(74, 'Sales Account', 'SubGroup', 10),
(75, 'Purchase Account', 'SubGroup', 11)
ON CONFLICT (grp_id) DO NOTHING;
SELECT setval('group_master_grp_id_seq', (SELECT MAX(grp_id) FROM group_master));

CREATE TABLE IF NOT EXISTS sub_group (
    sub_grp_id SERIAL PRIMARY KEY,
    grp_id INTEGER REFERENCES group_master(grp_id) ON DELETE CASCADE,
    sub_grp_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sub_group ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ledger (
    ledg_code SERIAL PRIMARY KEY,
    grp_id INTEGER REFERENCES group_master(grp_id),
    sub_grp_name VARCHAR(100),
    ledg_name VARCHAR(150) NOT NULL,
    print_name VARCHAR(150),
    street VARCHAR(200), add1 VARCHAR(200), add2 VARCHAR(200),
    city VARCHAR(50), dist VARCHAR(50), state VARCHAR(50),
    state_code VARCHAR(10), pin_code VARCHAR(10),
    gstin VARCHAR(50),
    reg_no INTEGER DEFAULT 0,
    pan_no VARCHAR(50), ph_no VARCHAR(50), cell_no VARCHAR(50), email VARCHAR(100),
    acc_type VARCHAR(20) DEFAULT 'Dr',
    op_bal NUMERIC(18,2) DEFAULT 0,
    op_bal_type VARCHAR(10) DEFAULT 'Dr',
    bal_amt NUMERIC(18,2) DEFAULT 0,
    bal_type VARCHAR(10) DEFAULT 'Dr',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS update_ledger_modtime ON ledger;
CREATE TRIGGER update_ledger_modtime BEFORE UPDATE ON ledger FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ledger_frm_code ON ledger(frm_code);
CREATE INDEX IF NOT EXISTS idx_ledger_grp_id ON ledger(grp_id);

CREATE TABLE IF NOT EXISTS ledg_opp_balance (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    ledg_code INTEGER REFERENCES ledger(ledg_code) ON DELETE CASCADE,
    grp_id INTEGER,
    stk_as_on TIMESTAMPTZ,
    bill_char VARCHAR(50), bill_ref_no VARCHAR(50),
    opp_amt NUMERIC(18,2) DEFAULT 0,
    bal_type VARCHAR(10) DEFAULT 'Dr',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ledg_opp_balance ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ledg_opp_balance_ledg_code ON ledg_opp_balance(ledg_code);

CREATE TABLE IF NOT EXISTS receipt_master (
    rm_ref_no SERIAL PRIMARY KEY,
    rm_rec_no INTEGER,
    rm_cr_code INTEGER REFERENCES ledger(ledg_code),
    rm_bill_char VARCHAR(10),
    rm_bill_ref_no VARCHAR(50),
    rm_bill_date TIMESTAMPTZ,
    rm_narration VARCHAR(500),
    rm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receipt_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS receipt_child (
    rc_ref_no SERIAL PRIMARY KEY,
    rm_ref_no INTEGER REFERENCES receipt_master(rm_ref_no) ON DELETE CASCADE,
    rc_dr_code INTEGER REFERENCES ledger(ledg_code),
    rc_amount NUMERIC(18,2) DEFAULT 0,
    rc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receipt_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payment_master (
    pm_ref_no SERIAL PRIMARY KEY,
    pm_rec_no INTEGER,
    pm_dr_code INTEGER REFERENCES ledger(ledg_code),
    pm_bill_char VARCHAR(10),
    pm_bill_ref_no VARCHAR(50),
    pm_bill_date TIMESTAMPTZ,
    pm_narration VARCHAR(500),
    pm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payment_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payment_child (
    pc_ref_no SERIAL PRIMARY KEY,
    pm_ref_no INTEGER REFERENCES payment_master(pm_ref_no) ON DELETE CASCADE,
    pc_cr_code INTEGER REFERENCES ledger(ledg_code),
    pc_amount NUMERIC(18,2) DEFAULT 0,
    pc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payment_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS journal_master (
    jm_ref_no SERIAL PRIMARY KEY,
    jm_rec_no INTEGER,
    jm_bill_char VARCHAR(10),
    jm_bill_ref_no VARCHAR(50),
    jm_bill_date TIMESTAMPTZ,
    jm_narration VARCHAR(500),
    jm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE journal_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS journal_child (
    jc_ref_no SERIAL PRIMARY KEY,
    jm_ref_no INTEGER REFERENCES journal_master(jm_ref_no) ON DELETE CASCADE,
    jc_ledg_code INTEGER REFERENCES ledger(ledg_code),
    jc_dr_amt NUMERIC(18,2) DEFAULT 0,
    jc_cr_amt NUMERIC(18,2) DEFAULT 0,
    jc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE journal_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS contra_master (
    cm_ref_no SERIAL PRIMARY KEY,
    cm_rec_no INTEGER,
    cm_bill_char VARCHAR(10),
    cm_bill_ref_no VARCHAR(50),
    cm_bill_date TIMESTAMPTZ,
    cm_narration VARCHAR(500),
    cm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contra_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS contra_child (
    cc_ref_no SERIAL PRIMARY KEY,
    cm_ref_no INTEGER REFERENCES contra_master(cm_ref_no) ON DELETE CASCADE,
    cc_ledg_code INTEGER REFERENCES ledger(ledg_code),
    cc_dr_amt NUMERIC(18,2) DEFAULT 0,
    cc_cr_amt NUMERIC(18,2) DEFAULT 0,
    cc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contra_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS credit_note_master (
    cnm_ref_no SERIAL PRIMARY KEY,
    cnm_rec_no INTEGER,
    cnm_reg_code INTEGER DEFAULT 50,
    cnm_tax_model VARCHAR(50),
    cnm_cr_code INTEGER REFERENCES ledger(ledg_code),
    cnm_dr_code INTEGER REFERENCES ledger(ledg_code),
    cnm_bill_char VARCHAR(10),
    cnm_bill_ref_no VARCHAR(50),
    cnm_bill_date TIMESTAMPTZ,
    cnm_entry_date TIMESTAMPTZ DEFAULT NOW(),
    cnm_dr_narr VARCHAR(500),
    cnm_cr_narr VARCHAR(500),
    cnm_tot_qty NUMERIC(18,2) DEFAULT 0,
    cnm_grd_tot NUMERIC(18,2) DEFAULT 0,
    cnm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_igst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_rnd_off NUMERIC(18,2) DEFAULT 0,
    cnm_net_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credit_note_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS credit_note_child (
    cnc_ref_no SERIAL PRIMARY KEY,
    cnm_ref_no INTEGER REFERENCES credit_note_master(cnm_ref_no) ON DELETE CASCADE,
    cnc_prcode INTEGER,
    cnc_pgrcode INTEGER,
    cnc_qty NUMERIC(18,2) DEFAULT 0,
    cnc_rate NUMERIC(18,2) DEFAULT 0,
    cnc_disc_perc NUMERIC(18,2) DEFAULT 0,
    cnc_disc_amt NUMERIC(18,2) DEFAULT 0,
    cnc_total NUMERIC(18,2) DEFAULT 0,
    cnc_igst_perc NUMERIC(18,2) DEFAULT 0,
    cnc_igst_amt NUMERIC(18,2) DEFAULT 0,
    cnc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    cnc_cgst_amt NUMERIC(18,2) DEFAULT 0,
    cnc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    cnc_sgst_amt NUMERIC(18,2) DEFAULT 0,
    cnc_net_tot NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credit_note_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS debit_note_master (
    dnm_ref_no SERIAL PRIMARY KEY,
    dnm_rec_no INTEGER,
    dnm_reg_code INTEGER DEFAULT 50,
    dnm_tax_model VARCHAR(50),
    dnm_cr_code INTEGER REFERENCES ledger(ledg_code),
    dnm_dr_code INTEGER REFERENCES ledger(ledg_code),
    dnm_bill_char VARCHAR(10),
    dnm_bill_ref_no VARCHAR(50),
    dnm_bill_date TIMESTAMPTZ,
    dnm_entry_date TIMESTAMPTZ DEFAULT NOW(),
    dnm_dr_narr VARCHAR(500),
    dnm_cr_narr VARCHAR(500),
    dnm_tot_qty NUMERIC(18,2) DEFAULT 0,
    dnm_grd_tot NUMERIC(18,2) DEFAULT 0,
    dnm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_igst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_rnd_off NUMERIC(18,2) DEFAULT 0,
    dnm_net_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE debit_note_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS debit_note_child (
    dnc_ref_no SERIAL PRIMARY KEY,
    dnm_ref_no INTEGER REFERENCES debit_note_master(dnm_ref_no) ON DELETE CASCADE,
    dnc_prcode INTEGER,
    dnc_pgrcode INTEGER,
    dnc_qty NUMERIC(18,2) DEFAULT 0,
    dnc_rate NUMERIC(18,2) DEFAULT 0,
    dnc_disc_perc NUMERIC(18,2) DEFAULT 0,
    dnc_disc_amt NUMERIC(18,2) DEFAULT 0,
    dnc_total NUMERIC(18,2) DEFAULT 0,
    dnc_igst_perc NUMERIC(18,2) DEFAULT 0,
    dnc_igst_amt NUMERIC(18,2) DEFAULT 0,
    dnc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    dnc_cgst_amt NUMERIC(18,2) DEFAULT 0,
    dnc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    dnc_sgst_amt NUMERIC(18,2) DEFAULT 0,
    dnc_net_tot NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE debit_note_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bill_adjustment (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    ledg_code INTEGER REFERENCES ledger(ledg_code),
    bill_char VARCHAR(50),
    bill_ref_no VARCHAR(50),
    bill_date TIMESTAMPTZ,
    bill_amt NUMERIC(18,2) DEFAULT 0,
    adj_amt NUMERIC(18,2) DEFAULT 0,
    rate_diff NUMERIC(18,2) DEFAULT 0,
    disc_amt NUMERIC(18,2) DEFAULT 0,
    bal_amt NUMERIC(18,2) DEFAULT 0,
    adj_type VARCHAR(50),
    ref_bill_no VARCHAR(50),
    ref_bill_date TIMESTAMPTZ,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bill_adjustment ENABLE ROW LEVEL SECURITY;
